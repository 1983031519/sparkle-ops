// api/google-oauth.ts — Edge function for Google Calendar OAuth + sync.
// Actions (selected via `?action=...`):
//   - exchange    : trades `code` for tokens, upserts into google_tokens
//   - status      : returns { connected: boolean, calendar_id?: string }
//   - sync        : create/update/delete event on Google Calendar
//   - disconnect  : deletes the user's google_tokens row
//
// Auth: every request MUST send `Authorization: Bearer <supabase_jwt>`.
// We use the service role key server-side to bypass RLS (never exposed to browser).

export const config = { runtime: 'edge' }

import { createClient } from '@supabase/supabase-js'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars'
const TZ = 'America/New_York'
const REFRESH_BUFFER_MS = 60_000 // refresh if token expires within 60s

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getEnv(name: string): string | null {
  // Edge runtime exposes env via process.env.
  return (process.env[name] as string | undefined) ?? null
}

function adminClient() {
  const url = getEnv('SUPABASE_URL') ?? getEnv('VITE_SUPABASE_URL')
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function resolveUserId(req: Request): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  try {
    const admin = adminClient()
    const { data, error } = await admin.auth.getUser(token)
    if (error) return null
    return data.user?.id ?? null
  } catch {
    return null
  }
}

/** Refresh the user's access_token if near expiry. Returns the (possibly new) access_token. */
async function ensureFreshToken(userId: string): Promise<{ access_token: string; calendar_id: string } | null> {
  const admin = adminClient()
  const { data: row, error } = await admin
    .from('google_tokens')
    .select('*')
    .eq('profile_id', userId)
    .maybeSingle()
  if (error || !row) return null

  const expiresAt = new Date(row.expires_at as string).getTime()
  if (expiresAt - Date.now() > REFRESH_BUFFER_MS) {
    return { access_token: row.access_token as string, calendar_id: (row.calendar_id as string) || 'primary' }
  }

  const clientId = getEnv('VITE_GOOGLE_CLIENT_ID') ?? getEnv('GOOGLE_CLIENT_ID')
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) throw new Error('Missing Google OAuth env vars')

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: row.refresh_token as string,
  })
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('[google-oauth] refresh failed', res.status, text)
    return null
  }
  const json = await res.json() as { access_token: string; expires_in: number }
  const newExpiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString()
  await admin.from('google_tokens')
    .update({ access_token: json.access_token, expires_at: newExpiresAt, updated_at: new Date().toISOString() } as never)
    .eq('profile_id', userId)
  return { access_token: json.access_token, calendar_id: (row.calendar_id as string) || 'primary' }
}

/** Build the Google Calendar event body from a Sparkle event row. */
function buildGoogleEventBody(ev: {
  title: string
  date: string
  time_start: string | null
  time_end: string | null
  address: string | null
  notes: string | null
}) {
  const base: Record<string, unknown> = {
    summary: ev.title,
    ...(ev.address ? { location: ev.address } : {}),
    ...(ev.notes ? { description: ev.notes } : {}),
  }
  if (ev.time_start) {
    const start = `${ev.date}T${ev.time_start.length === 5 ? ev.time_start + ':00' : ev.time_start}`
    const endSrc = ev.time_end || ev.time_start
    const end = `${ev.date}T${endSrc.length === 5 ? endSrc + ':00' : endSrc}`
    return {
      ...base,
      start: { dateTime: start, timeZone: TZ },
      end: { dateTime: end, timeZone: TZ },
    }
  }
  // All-day: end.date is exclusive, so use next day.
  const d = new Date(ev.date + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  const nextIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return {
    ...base,
    start: { date: ev.date },
    end: { date: nextIso },
  }
}

/* ─── Action handlers ─── */

async function handleExchange(userId: string, req: Request): Promise<Response> {
  const { code, redirect_uri } = (await req.json()) as { code?: string; redirect_uri?: string }
  if (!code || !redirect_uri) return jsonResponse({ error: 'code and redirect_uri are required' }, 400)

  const clientId = getEnv('VITE_GOOGLE_CLIENT_ID') ?? getEnv('GOOGLE_CLIENT_ID')
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) return jsonResponse({ error: 'Missing Google OAuth env vars' }, 500)

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri,
    grant_type: 'authorization_code',
  })
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('[google-oauth] exchange failed', res.status, text)
    return jsonResponse({ error: `Google token exchange failed: ${res.status}`, details: text }, 400)
  }
  const json = await res.json() as { access_token: string; refresh_token?: string; expires_in: number }
  if (!json.refresh_token) {
    // Happens when the user already authorized in the past without `prompt=consent`.
    // We keep the old refresh_token if we already have one.
    const admin = adminClient()
    const { data: existing } = await admin.from('google_tokens').select('refresh_token').eq('profile_id', userId).maybeSingle()
    if (!existing?.refresh_token) {
      return jsonResponse({ error: 'No refresh_token returned by Google. Re-authorize with prompt=consent.' }, 400)
    }
    json.refresh_token = existing.refresh_token as string
  }

  const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString()
  const admin = adminClient()
  const { error } = await admin
    .from('google_tokens')
    .upsert(
      {
        profile_id: userId,
        access_token: json.access_token,
        refresh_token: json.refresh_token!,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'profile_id' },
    )
  if (error) return jsonResponse({ error: error.message }, 500)
  return jsonResponse({ ok: true })
}

async function handleStatus(userId: string): Promise<Response> {
  const admin = adminClient()
  const { data } = await admin
    .from('google_tokens')
    .select('calendar_id, expires_at')
    .eq('profile_id', userId)
    .maybeSingle()
  if (!data) return jsonResponse({ connected: false })
  return jsonResponse({ connected: true, calendar_id: data.calendar_id ?? 'primary' })
}

async function handleDisconnect(userId: string): Promise<Response> {
  const admin = adminClient()
  const { error } = await admin.from('google_tokens').delete().eq('profile_id', userId)
  if (error) return jsonResponse({ error: error.message }, 500)
  return jsonResponse({ ok: true })
}

interface SyncBody {
  operation: 'create' | 'update' | 'delete'
  event_id?: string
  google_event_id?: string | null
}

async function handleSync(userId: string, req: Request): Promise<Response> {
  const body = (await req.json()) as SyncBody
  if (!body.operation) return jsonResponse({ error: 'operation is required' }, 400)

  const fresh = await ensureFreshToken(userId)
  if (!fresh) return jsonResponse({ skipped: true, reason: 'not_connected' })
  const { access_token, calendar_id } = fresh
  const calBase = `${GOOGLE_CAL_BASE}/${encodeURIComponent(calendar_id || 'primary')}/events`

  const admin = adminClient()

  if (body.operation === 'delete') {
    if (!body.google_event_id) return jsonResponse({ skipped: true, reason: 'no_google_event_id' })
    const res = await fetch(`${calBase}/${encodeURIComponent(body.google_event_id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      const text = await res.text()
      return jsonResponse({ error: `Google delete failed: ${res.status}`, details: text }, 502)
    }
    return jsonResponse({ ok: true })
  }

  if (!body.event_id) return jsonResponse({ error: 'event_id is required' }, 400)
  const { data: ev, error: evErr } = await admin.from('events').select('*').eq('id', body.event_id).maybeSingle()
  if (evErr || !ev) return jsonResponse({ error: 'Event not found' }, 404)

  // Authorization: the event must be visible to this user. Since RLS on events allows any
  // authenticated user to read, we accept any; future-proofing would add stricter checks.
  const eventBody = buildGoogleEventBody({
    title: ev.title as string,
    date: ev.date as string,
    time_start: (ev.time_start as string | null) ?? null,
    time_end: (ev.time_end as string | null) ?? null,
    address: (ev.address as string | null) ?? null,
    notes: (ev.notes as string | null) ?? null,
  })

  if (body.operation === 'create') {
    const existingGid = (ev.google_event_id as string | null) ?? null
    const url = existingGid ? `${calBase}/${encodeURIComponent(existingGid)}` : calBase
    const method = existingGid ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody),
    })
    if (!res.ok) {
      const text = await res.text()
      return jsonResponse({ error: `Google create failed: ${res.status}`, details: text }, 502)
    }
    const json = await res.json() as { id: string; htmlLink?: string }
    await admin.from('events').update({ google_event_id: json.id } as never).eq('id', body.event_id)
    return jsonResponse({ ok: true, google_event_id: json.id, html_link: json.htmlLink })
  }

  if (body.operation === 'update') {
    const gid = (ev.google_event_id as string | null) ?? null
    if (!gid) {
      // Event wasn't synced before — fall back to create.
      const res = await fetch(calBase, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventBody),
      })
      if (!res.ok) {
        const text = await res.text()
        return jsonResponse({ error: `Google create failed: ${res.status}`, details: text }, 502)
      }
      const json = await res.json() as { id: string }
      await admin.from('events').update({ google_event_id: json.id } as never).eq('id', body.event_id)
      return jsonResponse({ ok: true, google_event_id: json.id, fallback: 'created' })
    }
    const res = await fetch(`${calBase}/${encodeURIComponent(gid)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody),
    })
    if (!res.ok) {
      const text = await res.text()
      return jsonResponse({ error: `Google update failed: ${res.status}`, details: text }, 502)
    }
    return jsonResponse({ ok: true })
  }

  return jsonResponse({ error: 'Unknown operation' }, 400)
}

/* ─── Handler ─── */

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  if (!action) return jsonResponse({ error: 'action query param is required' }, 400)

  const userId = await resolveUserId(req)
  if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401)

  try {
    switch (action) {
      case 'exchange': return await handleExchange(userId, req)
      case 'status': return await handleStatus(userId)
      case 'disconnect': return await handleDisconnect(userId)
      case 'sync': return await handleSync(userId, req)
      default: return jsonResponse({ error: `Unknown action: ${action}` }, 400)
    }
  } catch (err) {
    console.error('[google-oauth] handler error:', err)
    return jsonResponse({ error: (err as Error).message }, 500)
  }
}
