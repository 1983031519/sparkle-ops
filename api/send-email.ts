import { Resend } from 'resend'

// Node (default) serverless runtime so the Resend SDK and process.env work normally.

type DocumentType = 'invoice' | 'estimate' | 'project'

interface DocumentData {
  number: string
  date: string        // already-formatted string, e.g. "Apr 10, 2026"
  total: number
  clientName: string
}

interface SendEmailBody {
  to: string
  subject?: string
  type: DocumentType
  documentData: DocumentData
  fromEmail: 'oscar@sparklestonepavers.com' | 'info@sparklestonepavers.com'
}

const ALLOWED_FROMS = new Set([
  'oscar@sparklestonepavers.com',
  'info@sparklestonepavers.com',
])

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

function buildHtml(type: DocumentType, d: DocumentData): string {
  const label = TYPE_LABEL[type]
  const clientName = escapeHtml(d.clientName || 'Valued Client')
  const number = escapeHtml(d.number || '')
  const date = escapeHtml(d.date || '')
  const total = escapeHtml(fmtMoney(d.total))

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
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#444;">
                Please find your <strong>${label}</strong> details below.
              </p>

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

              <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#555;">
                For questions, reply to this email or call
                <a href="tel:+19413875133" style="color:#1a2744;font-weight:600;text-decoration:none;">(941) 387-5133</a>.
              </p>

              <p style="margin:24px 0 0;font-size:13px;color:#1a2744;">
                Thank you,<br />
                <strong>Sparkle Stone &amp; Pavers</strong>
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

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return jsonResponse(500, { error: 'RESEND_API_KEY not configured' })
  }

  let body: SendEmailBody
  try {
    body = (await req.json()) as SendEmailBody
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }

  const { to, subject, type, documentData, fromEmail } = body

  if (!to || typeof to !== 'string') {
    return jsonResponse(400, { error: 'Missing "to" email address' })
  }
  if (!type || !(type in TYPE_LABEL)) {
    return jsonResponse(400, { error: 'Invalid document "type"' })
  }
  if (!documentData || typeof documentData !== 'object') {
    return jsonResponse(400, { error: 'Missing "documentData"' })
  }
  if (!fromEmail || !ALLOWED_FROMS.has(fromEmail)) {
    return jsonResponse(400, { error: 'Invalid "fromEmail"' })
  }

  const label = TYPE_LABEL[type]
  const finalSubject = subject && subject.trim().length > 0
    ? subject
    : `Your ${label} from Sparkle Stone & Pavers${documentData.number ? ` — ${documentData.number}` : ''}`

  try {
    const resend = new Resend(apiKey)

    const sendPromise = resend.emails.send({
      from: `Sparkle Stone & Pavers <${fromEmail}>`,
      to: [to],
      replyTo: 'oscar@sparklestonepavers.com',
      subject: finalSubject,
      html: buildHtml(type, documentData),
    })

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Resend API timeout after 8s')), 8000)
    )

    const { data, error } = await Promise.race([sendPromise, timeoutPromise])

    if (error) {
      console.error('[send-email] Resend error (full):', JSON.stringify(error))
      return jsonResponse(502, { error: 'Failed to send email', details: error.message ?? JSON.stringify(error) })
    }

    return jsonResponse(200, { ok: true, id: data?.id ?? null })
  } catch (err) {
    console.error('[send-email] Unexpected error:', err instanceof Error ? err.message : err)
    return jsonResponse(500, {
      error: 'Internal server error',
      details: err instanceof Error ? err.message : 'Unknown',
    })
  }
}
