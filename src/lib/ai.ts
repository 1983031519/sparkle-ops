// Frontend helper to call the Anthropic API via serverless proxy
// The API key is NEVER in the browser — only on the server at /api/ai

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AiResponse {
  content: { type: string; text: string }[]
  model: string
  usage: { input_tokens: number; output_tokens: number }
}

export async function askAi(
  messages: Message[],
  context?: string,
  options?: { model?: string; max_tokens?: number }
): Promise<string> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      context,
      model: options?.model,
      max_tokens: options?.max_tokens,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `API error ${res.status}`)
  }

  const data: AiResponse = await res.json()
  return data.content?.[0]?.text ?? ''
}
