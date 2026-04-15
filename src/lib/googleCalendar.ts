// Client helper for the Google Calendar OAuth + sync edge function.
// Every call carries the current Supabase JWT so the edge function can identify the user.

import { supabase } from '@/lib/supabase'

const SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export function redirectUri(): string {
  return `${window.location.origin}/schedule/google-callback`
}

export function buildAuthUrl(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  if (!clientId) throw new Error('VITE_GOOGLE_CLIENT_ID is not configured')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')
  return { Authorization: `Bearer ${token}` }
}

async function post<T>(action: string, body: unknown = {}): Promise<T> {
  const headers = await authHeader()
  const res = await fetch(`/api/google-oauth?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`)
  return data as T
}

export async function exchangeCode(code: string): Promise<{ ok: true }> {
  return post('exchange', { code, redirect_uri: redirectUri() })
}

export interface StatusResponse { connected: boolean; calendar_id?: string }

export async function getStatus(): Promise<StatusResponse> {
  try { return await post<StatusResponse>('status') } catch { return { connected: false } }
}

export async function disconnect(): Promise<{ ok: true }> {
  return post('disconnect')
}

export interface SyncResult { ok?: boolean; skipped?: boolean; reason?: string; error?: string }

export async function syncEvent(
  operation: 'create' | 'update' | 'delete',
  payload: { event_id?: string; google_event_id?: string | null },
): Promise<SyncResult> {
  try {
    return await post<SyncResult>('sync', { operation, ...payload })
  } catch (err) {
    return { error: (err as Error).message }
  }
}
