// Edge runtime — same as api/ai.ts. No Node SDK needed; uses fetch directly.
export const config = { runtime: 'edge' }

type DocumentType = 'invoice' | 'estimate' | 'project'

interface DocumentData {
  number: string
  date: string        // already-formatted string, e.g. "Apr 10, 2026"
  total: number
  clientName: string
}

type SenderId = 'oscar' | 'sabrina' | 'info'

interface SendEmailBody {
  to: string | string[]
  cc?: string[]
  subject?: string
  type: DocumentType
  documentData: DocumentData
  senderId?: SenderId
  // TODO: remover fromEmail legado após validação em prod (1 semana)
  fromEmail?: string
  viewUrl?: string
  pdfBase64?: string
  personalMessage?: string
}

// Mirror of src/lib/senders.ts — duplicated intentionally to keep the edge function
// free of cross-boundary imports. Keep in sync.
const SENDERS: Record<SenderId, { id: SenderId; email: string; name: string; signature: string }> = {
  oscar: {
    id: 'oscar',
    email: 'oscar@sparklestonepavers.com',
    name: 'Oscar Rocha',
    signature: 'Oscar Rocha\nField Operations\nSparkle Stone & Pavers\n(941) 387-5133',
  },
  sabrina: {
    id: 'sabrina',
    email: 'sabrina@sparklestonepavers.com',
    name: 'Sabrina — Sparkle Stone & Pavers',
    signature: 'Sabrina\nOffice & Scheduling\nSparkle Stone & Pavers\n(941) 387-5134',
  },
  info: {
    id: 'info',
    email: 'info@sparklestonepavers.com',
    name: 'Sparkle Stone & Pavers',
    signature: 'Sparkle Stone & Pavers Team\n(941) 387-5133\ninfo@sparklestonepavers.com',
  },
}

const SENDERS_BY_EMAIL: Record<string, SenderId> = Object.fromEntries(
  Object.values(SENDERS).map(s => [s.email, s.id]),
)

const TYPE_LABEL: Record<DocumentType, string> = {
  invoice: 'Invoice',
  estimate: 'Estimate',
  project: 'Project Proposal',
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderSignatureHtml(signature: string): string {
  // First line is the person/team name → bold. Remaining lines are plain.
  const lines = signature.split('\n')
  return lines
    .map((line, i) => (i === 0 ? `<strong>${escapeHtml(line)}</strong>` : escapeHtml(line)))
    .join('<br />')
}

function buildHtml(type: DocumentType, d: DocumentData, signatureHtml: string, personalMessage?: string, viewUrl?: string): string {
  const label = TYPE_LABEL[type]
  const clientName = escapeHtml(d.clientName || 'Valued Client')
  const number = escapeHtml(d.number || '')
  const date = escapeHtml(d.date || '')
  const total = escapeHtml(fmtMoney(d.total))
  const safeMessage = personalMessage ? escapeHtml(personalMessage.trim()) : ''
  const safeViewUrl = viewUrl ? escapeHtml(viewUrl) : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Sparkle Stone &amp; Pavers — ${label}</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#333;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f4f2;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
          <!-- Header -->
          <tr>
            <td style="background:#1a2744;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;color:#c8a96e;">Sparkle Stone &amp; Pavers</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 12px;font-size:15px;color:#1a2744;">Hello ${clientName},</p>

              ${safeMessage ? `
              <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#555;font-style:italic;border-left:3px solid #c8a96e;padding-left:12px;">${safeMessage}</p>
              ` : `
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#444;">
                Please find your <strong>${label}</strong> details below.
              </p>
              `}

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f4f2;border:1px solid #e8e6e2;border-radius:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:13px;color:#444;">
                      <tr>
                        <td style="padding:6px 0;color:#9a8f82;text-transform:uppercase;letter-spacing:0.08em;font-size:11px;font-weight:600;">${label} #</td>
                        <td style="padding:6px 0;text-align:right;font-family:ui-monospace,'SF Mono',Menlo,monospace;color:#1a2744;font-weight:600;">${number}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#9a8f82;text-transform:uppercase;letter-spacing:0.08em;font-size:11px;font-weight:600;">Date</td>
                        <td style="padding:6px 0;text-align:right;color:#1a2744;">${date}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#9a8f82;text-transform:uppercase;letter-spacing:0.08em;font-size:11px;font-weight:600;">Client</td>
                        <td style="padding:6px 0;text-align:right;color:#1a2744;">${clientName}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0 6px;border-top:1px solid #e8e6e2;color:#9a8f82;text-transform:uppercase;letter-spacing:0.08em;font-size:11px;font-weight:600;">Total</td>
                        <td style="padding:10px 0 6px;border-top:1px solid #e8e6e2;text-align:right;font-size:18px;font-weight:700;color:#1a2744;">${total}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${safeViewUrl ? `
              <p style="margin:28px 0 0;text-align:center;">
                <a href="${safeViewUrl}" style="display:inline-block;background:#1a2744;color:#c8a96e;font-size:13px;font-weight:600;text-decoration:none;padding:10px 28px;border-radius:6px;letter-spacing:0.3px;">View ${label} Online</a>
              </p>
              ` : ''}

              <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#555;">
                For questions, reply to this email or call
                <a href="tel:+19413875133" style="color:#1a2744;font-weight:600;text-decoration:none;">(941) 387-5133</a>.
              </p>

              <p style="margin:24px 0 0;font-size:13px;color:#1a2744;line-height:1.6;">
                Thank you,<br />
                ${signatureHtml}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f5f4f2;border-top:1px solid #e8e6e2;padding:16px 32px;text-align:center;font-size:11px;color:#9a8f82;line-height:1.5;">
              Sparkle Solutions LLC · 14651 Westbrook Cir #210, Bradenton FL 34211
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const apiKey = (process.env as Record<string, string | undefined>).RESEND_API_KEY
  if (!apiKey) {
    return jsonResponse(500, { error: 'RESEND_API_KEY not configured' })
  }

  let body: SendEmailBody
  try {
    body = (await req.json()) as SendEmailBody
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }

  const { to, cc, subject, type, documentData, senderId, fromEmail, viewUrl, pdfBase64, personalMessage } = body

  const toValid = (typeof to === 'string' && to.length > 0) ||
    (Array.isArray(to) && to.length > 0 && to.every(e => typeof e === 'string'))
  if (!toValid) {
    return jsonResponse(400, { error: 'Missing "to" email address' })
  }
  if (!type || !(type in TYPE_LABEL)) {
    return jsonResponse(400, { error: 'Invalid document "type"' })
  }
  if (!documentData || typeof documentData !== 'object') {
    return jsonResponse(400, { error: 'Missing "documentData"' })
  }

  // Resolve sender: prefer senderId (new), fall back to fromEmail (legacy).
  // TODO: remover fromEmail legado após validação em prod (1 semana)
  let resolvedSenderId: SenderId | undefined
  if (senderId && senderId in SENDERS) {
    resolvedSenderId = senderId
  } else if (fromEmail && typeof fromEmail === 'string' && fromEmail in SENDERS_BY_EMAIL) {
    resolvedSenderId = SENDERS_BY_EMAIL[fromEmail]
  }
  if (!resolvedSenderId) {
    return jsonResponse(400, { error: 'Missing or invalid sender ("senderId" or "fromEmail")' })
  }
  const sender = SENDERS[resolvedSenderId]

  const label = TYPE_LABEL[type]
  const finalSubject = subject && subject.trim().length > 0
    ? subject
    : `Your ${label} from Sparkle Stone & Pavers${documentData.number ? ` — ${documentData.number}` : ''}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${sender.name} <${sender.email}>`,
        to: Array.isArray(to) ? to : [to],
        ...(cc && cc.length > 0 ? { cc } : {}),
        reply_to: sender.email,
        subject: finalSubject,
        html: buildHtml(type, documentData, renderSignatureHtml(sender.signature), personalMessage, viewUrl),
        ...(pdfBase64 ? {
          attachments: [{
            filename: `Sparkle_${TYPE_LABEL[type].replace(' ', '_')}_${documentData.number}.pdf`,
            content: pdfBase64,
          }],
        } : {}),
      }),
    })

    clearTimeout(timeout)

    const data = await res.json() as { id?: string; name?: string; message?: string; statusCode?: number }

    if (!res.ok) {
      console.error('[send-email] Resend error:', JSON.stringify(data))
      return jsonResponse(502, {
        error: 'Failed to send email',
        details: data.message ?? data.name ?? `HTTP ${res.status}`,
      })
    }

    return jsonResponse(200, { ok: true, id: data.id ?? null })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown'
    console.error('[send-email] Unexpected error:', msg)
    if (err instanceof Error && err.name === 'AbortError') {
      return jsonResponse(504, { error: 'Resend API timed out' })
    }
    return jsonResponse(500, { error: 'Internal server error', details: msg })
  }
}
