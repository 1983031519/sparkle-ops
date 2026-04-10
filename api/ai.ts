import type { IncomingMessage, ServerResponse } from 'http'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => { try { resolve(JSON.parse(body)) } catch { reject(new Error('Invalid JSON')) } })
    req.on('error', reject)
  })
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  if (!ANTHROPIC_API_KEY) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured on server' }))
    return
  }

  try {
    const body = await parseBody(req)
    const messages = body.messages as { role: string; content: string }[]
    const context = body.context as string | undefined
    const model = (body.model as string) || 'claude-sonnet-4-20250514'
    const max_tokens = (body.max_tokens as number) || 1024

    if (!messages || !Array.isArray(messages)) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'messages array is required' }))
      return
    }

    const systemPrompt = context
      ? `You are Rocko, the AI assistant for Sparkle Stone & Pavers operations app. You help with estimates, invoices, job management, and business questions. Be concise and professional.\n\nCurrent context:\n${context}`
      : 'You are Rocko, the AI assistant for Sparkle Stone & Pavers operations app. You help with estimates, invoices, job management, and business questions. Be concise and professional.'

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens, system: systemPrompt, messages }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      res.statusCode = response.status
      res.end(JSON.stringify({ error: `Anthropic API error: ${response.status}`, details: errorBody }))
      return
    }

    const data = await response.json()
    res.statusCode = 200
    res.end(JSON.stringify(data))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ error: 'Internal server error', message: err instanceof Error ? err.message : 'Unknown' }))
  }
}
