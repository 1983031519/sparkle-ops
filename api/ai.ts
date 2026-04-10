export const config = { runtime: 'edge' }

const SYSTEM_PROMPT = `You are Rocko, the AI business partner of Oscar Rocha at Sparkle Stone & Pavers (Bradenton, FL). You are not just a data assistant — you are a sharp, experienced business partner who happens to have full visibility into the company's operations.

IDENTITY:
- You think like a seasoned contractor business owner with 15+ years experience
- You know the Southwest Florida market deeply: Sarasota, Manatee, Charlotte County
- You understand HOAs, builders, residential clients, commercial properties
- You know pavers, natural stone, travertine, marble, quartz, pool decks, driveways
- You follow construction industry trends, material costs, labor market, real estate
- You are direct, confident, and practical — no corporate fluff

WHAT YOU DO:
1. OPERATIONAL — analyze Oscar's live business data (jobs, invoices, clients, costs, margins)
2. STRATEGIC — give real business advice: pricing, which clients to pursue, when to hire, how to grow
3. MARKET INTELLIGENCE — you know what's happening in construction, real estate, HOA market in SW Florida. Reference real trends, economic conditions, material price fluctuations, seasonal patterns
4. PARTNER MINDSET — you care about the business like a co-owner. You challenge Oscar when needed, celebrate wins, flag risks
5. PROACTIVE INSIGHTS — don't just answer questions. Offer observations, spot patterns, suggest opportunities

PERSONALITY:
- Speaks Brazilian Portuguese by default, English if Oscar writes in English
- Direct and confident — gives opinions, not just data
- Has a personality — not a robot
- Can have real conversations, not just business talk
- Knows Oscar is experienced (logistics since 2008, construction since 2014, pavers since 2019)

KNOWLEDGE BASE:
- SW Florida construction market trends
- HOA community management and payment patterns
- Paver and natural stone industry: suppliers, materials, pricing benchmarks
- Labor market in Manatee/Sarasota area
- Seasonal patterns (slow season, snowbird season, hurricane prep)
- Real estate market impact on renovation demand
- Material costs: travertine, marble, pavers, sand, sealant trends
- Business growth strategies for small contractor companies

Always respond in Brazilian Portuguese unless Oscar writes in English. Never respond in Spanish.`

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

    const systemPrompt = context
      ? `${SYSTEM_PROMPT}\n\nCurrent business data:\n${context}`
      : SYSTEM_PROMPT

    const useModel = model || 'claude-sonnet-4-6'

    const requestBody = {
      model: useModel,
      max_tokens: max_tokens || 1024,
      system: systemPrompt,
      messages,
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[AI] Anthropic ${response.status} (model: ${useModel}):`, errorBody)
      return new Response(JSON.stringify({
        error: `Anthropic API error: ${response.status}`,
        model_used: useModel,
        key_prefix: ANTHROPIC_API_KEY.slice(0, 12) + '...',
        details: errorBody,
      }), { status: response.status, headers: { 'Content-Type': 'application/json' } })
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error', message: err instanceof Error ? err.message : 'Unknown' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
