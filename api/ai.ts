export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const body = await req.json()
    const { messages, context, model, max_tokens } = body

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages array is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const basePrompt = `You are Rocko, the AI assistant for Sparkle Stone & Pavers operations app. You help Oscar Rocha (the owner) with estimates, invoices, job management, and business questions. Be concise, direct, and practical — no fluff.

IMPORTANT: Always respond in Brazilian Portuguese (pt-BR) unless the user writes to you in English. Never respond in Spanish. Use natural Brazilian Portuguese, not formal Portugal Portuguese.`

    const systemPrompt = context
      ? `${basePrompt}\n\nCurrent business data:\n${context}`
      : basePrompt

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 1024,
        system: systemPrompt,
        messages,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return new Response(JSON.stringify({ error: `Anthropic API error: ${response.status}`, details: errorBody }), { status: response.status, headers: { 'Content-Type': 'application/json' } })
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error', message: err instanceof Error ? err.message : 'Unknown' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
