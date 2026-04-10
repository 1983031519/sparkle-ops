import { useState, useEffect } from 'react'
import { Mail } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'

export type SendDocumentType = 'invoice' | 'estimate' | 'project'

const FROM_OPTIONS = [
  'oscar@sparklestonepavers.com',
  'info@sparklestonepavers.com',
] as const
type FromEmail = typeof FROM_OPTIONS[number]

interface Props {
  open: boolean
  onClose: () => void
  type: SendDocumentType
  documentId: string    // uuid of the invoice/estimate/project row
  clientEmail: string | null | undefined
  pdfBase64?: string    // base64-encoded PDF to attach (optional — email sends without if missing)
  documentData: {
    number: string
    date: string        // pre-formatted, e.g. "Apr 10, 2026"
    total: number
    clientName: string
  }
}

export function SendDocumentModal({ open, onClose, type, documentId, clientEmail, pdfBase64, documentData }: Props) {
  const [fromEmail, setFromEmail] = useState<FromEmail>('oscar@sparklestonepavers.com')
  const [personalMessage, setPersonalMessage] = useState('')
  const [sending, setSending] = useState(false)
  const toast = useToast()

  // Reset default selection every time the modal opens
  useEffect(() => {
    if (open) {
      setFromEmail('oscar@sparklestonepavers.com')
      setPersonalMessage('')
      setSending(false)
    }
  }, [open])

  async function handleSend() {
    if (!clientEmail) {
      toast.error('No client email on file.')
      return
    }
    setSending(true)

    // Generate a public view link (best-effort — email still sends if this fails)
    let viewUrl: string | undefined
    try {
      const { data: linkRaw } = await supabase
        .from('document_links')
        .insert({ document_type: type, document_id: documentId } as never)
        .select('token')
        .single()
      const linkData = linkRaw as { token: string } | null
      if (linkData?.token) {
        viewUrl = `https://sparkle-ops.vercel.app/view/${linkData.token}`
      }
    } catch { /* ignore */ }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          to: clientEmail,
          type,
          documentData,
          fromEmail,
          viewUrl,
          pdfBase64,
          personalMessage: personalMessage.trim() || undefined,
        }),
      })
      clearTimeout(timeout)
      if (!res.ok) {
        let detail = ''
        try {
          const j = await res.json()
          detail = j?.details || j?.error || ''
        } catch { /* ignore */ }
        toast.error(detail ? `Failed to send email — ${detail}` : 'Failed to send email')
        return
      }
      toast.success(`Email sent to ${clientEmail}`)
      onClose()
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof Error && err.name === 'AbortError') {
        toast.error('Request timed out — check your connection')
      } else {
        toast.error(`Failed to send email${err instanceof Error ? ` — ${err.message}` : ''}`)
      }
    } finally {
      setSending(false)
    }
  }

  const label = type === 'invoice' ? 'Invoice' : type === 'estimate' ? 'Estimate' : 'Project Proposal'
  const hasEmail = !!clientEmail

  return (
    <Modal open={open} onClose={onClose} title={`Send ${label}`}>
      <div className="space-y-5">
        {/* Send to */}
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-stone-500 mb-1.5">Send to</p>
          {hasEmail ? (
            <p className="text-[14px] text-navy-900 break-all">{clientEmail}</p>
          ) : (
            <p className="text-[13px] text-red-600">No email on file for this client. Add one to the client record first.</p>
          )}
        </div>

        {/* From */}
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-stone-500 mb-1.5">From</p>
          <div className="space-y-1.5">
            {FROM_OPTIONS.map(addr => (
              <label key={addr} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="send-from"
                  value={addr}
                  checked={fromEmail === addr}
                  onChange={() => setFromEmail(addr)}
                  className="accent-navy-900"
                />
                <span className="text-[13px] text-stone-700">{addr}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Personal message */}
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-stone-500 mb-1.5">Message</p>
          <textarea
            rows={4}
            value={personalMessage}
            onChange={e => setPersonalMessage(e.target.value)}
            placeholder="Add a personal message to your client..."
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-[13px] text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 resize-y"
          />
        </div>

        {/* Summary */}
        <div className="rounded-lg bg-stone-50 border border-stone-200 p-3 text-[12px] text-stone-600 space-y-1">
          <div className="flex justify-between"><span>{label} #</span><span className="font-mono text-navy-900">{documentData.number}</span></div>
          <div className="flex justify-between"><span>Client</span><span className="text-navy-900">{documentData.clientName || '—'}</span></div>
          <div className="flex justify-between"><span>Total</span><span className="font-semibold text-navy-900">${documentData.total.toFixed(2)}</span></div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-stone-200 pt-4">
          <Button variant="secondary" type="button" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button type="button" onClick={handleSend} disabled={sending || !hasEmail}>
            <Mail className="h-4 w-4" />
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
