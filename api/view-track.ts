// Edge runtime — updates viewed_at on a document_link token (first view only).
export const config = { runtime: 'edge' }

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  let body: { token?: string }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }

  const { token } = body
  if (!token) return json(400, { error: 'Missing token' })

  const supabaseUrl = (process.env as Record<string, string>).VITE_SUPABASE_URL
  const supabaseKey = (process.env as Record<string, string>).VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return json(500, { error: 'Supabase not configured' })
  }

  // PATCH only rows where token matches AND viewed_at is still null (first view)
  const res = await fetch(
    `${supabaseUrl}/rest/v1/document_links?token=eq.${encodeURIComponent(token)}&viewed_at=is.null`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ viewed_at: new Date().toISOString() }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    console.error('[view-track] Supabase error:', err)
    return json(500, { error: 'Failed to record view' })
  }

  return json(200, { ok: true })
}
