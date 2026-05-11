import { useState, useEffect } from 'react'
import { Mail } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { getDefaultSender, getSender, type SenderId } from '@/lib/senders'
import { SenderSelector } from '@/components/email/SenderSelector'
import { useAuth } from '@/hooks/useAuth'

export type SendDocumentType = 'invoice' | 'estimate' | 'project'

interface CcEmailOption {
  label: string
  email: string
}

interface Props {
  open: boolean
  onClose: () => void
  type: SendDocumentType
  documentId: string    // uuid of the invoice/estimate/project row
  clientEmail: string | null | undefined
  ccEmails?: CcEmailOption[]
  pdfBase64?: string    // base64-encoded PDF to attach (optional — email sends without if missing)
  documentData: {
    number: string
    date: string        // pre-formatted, e.g. "Apr 10, 2026"
    total: number
    clientName: string
  }
  onSent?: () => void   // called after successful email send
}

export function SendDocumentModal({ open, onClose, type, documentId, clientEmail, ccEmails = [], pdfBase64, documentData, onSent }: Props) {
  const { user } = useAuth()
  const [senderId, setSenderId] = useState<SenderId>(() => getDefaultSender(user?.email))
  const [personalMessage, setPersonalMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const toast = useToast()

  // Reset selections every time the modal opens
  useEffect(() => {
    if (open) {
      setSenderId(getDefaultSender(user?.email))
      setPersonalMessage('')
      setSending(false)
      setSelectedEmails(clientEmail ? [clientEmail] : [])
    }
  }, [open, user?.email, clientEmail])

  function toggleEmail(email: string) {
    setSelectedEmails(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    )
  }

  const allOptions: CcEmailOption[] = [
    ...(clientEmail ? [{ label: 'Primary', email: clientEmail }] : []),
    ...ccEmails.filter(c => c.email !== clientEmail),
  ]

  const canSend = selectedEmails.length > 0

  async function handleSend() {
    if (!canSend) {
      toast.error('Select at least one recipient.')
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
          to: selectedEmails[0],
          cc: selectedEmails.slice(1).length > 0 ? selectedEmails.slice(1) : undefined,
          type,
          documentData,
          senderId,
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
      // Auto-update status to "Sent" for estimates and projects
      if (type === 'estimate') {
        await supabase.from('estimates').update({ status: 'Sent' } as never).eq('id', documentId)
      } else if (type === 'project') {
        await supabase.from('projects').update({ status: 'Sent' } as never).eq('id', documentId)
      }

      // Placeholder log — Phase 2 will persist this in an email_send_log table.
      const sender = getSender(senderId)
      const typeLabel = type === 'invoice' ? 'Invoice' : type === 'estimate' ? 'Estimate' : 'Project Proposal'
      console.log('[email_sent]', {
        sent_by_user_id: user?.id ?? null,
        sent_from_email: sender.email,
        to: selectedEmails[0],
        cc: selectedEmails.slice(1),
        subject: `Your ${typeLabel} from Sparkle Stone & Pavers${documentData.number ? ` — ${documentData.number}` : ''}`,
        document_type: type,
        document_id: documentId,
        timestamp: new Date().toISOString(),
      })

      const recipientCount = selectedEmails.length
      toast.success(recipientCount > 1
        ? `Email sent to ${recipientCount} recipients`
        : `Email sent to ${selectedEmails[0]}`
      )
      onSent?.()
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

  return (
    <Modal open={open} onClose={onClose} title={`Send ${label}`}>
      <div className="space-y-5">
        {/* Send from */}
        <div>
          <p className="text-eyebrow font-semibold uppercase tracking-[0.5px] text-gray-500 mb-1.5">Send from</p>
          <SenderSelector value={senderId} onChange={setSenderId} disabled={sending} />
        </div>

        {/* Send to */}
        <div>
          <p className="text-eyebrow font-semibold uppercase tracking-[0.5px] text-gray-500 mb-1.5">Send to</p>
          {allOptions.length === 0 ? (
            <p className="text-label text-red-600">No email on file for this client. Add one to the client record first.</p>
          ) : (
            <div className="space-y-2">
              {allOptions.map(opt => (
                <label key={opt.email} className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-[#4F6CF7] focus:ring-[#4F6CF7]/20"
                    checked={selectedEmails.includes(opt.email)}
                    onChange={() => toggleEmail(opt.email)}
                    disabled={sending}
                  />
                  <span className="text-label text-gray-800">{opt.email}</span>
                  <span className="text-eyebrow text-gray-400">{opt.label}</span>
                </label>
              ))}
              {!canSend && (
                <p className="text-eyebrow text-red-500 pt-1">Select at least one recipient.</p>
              )}
            </div>
          )}
        </div>

        {/* Personal message */}
        <div>
          <p className="text-eyebrow font-semibold uppercase tracking-[0.5px] text-gray-500 mb-1.5">Message</p>
          <textarea
            rows={4}
            value={personalMessage}
            onChange={e => setPersonalMessage(e.target.value)}
            placeholder="Add a personal message to your client..."
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-label text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4F6CF7]/20 focus:border-[#4F6CF7] resize-y"
          />
        </div>

        {/* Summary */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-eyebrow text-gray-600 space-y-1">
          <div className="flex justify-between"><span>{label} #</span><span className="font-mono text-gray-900">{documentData.number}</span></div>
          <div className="flex justify-between"><span>Client</span><span className="text-gray-900">{documentData.clientName || '—'}</span></div>
          <div className="flex justify-between"><span>Total</span><span className="font-semibold text-gray-900">${documentData.total.toFixed(2)}</span></div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <Button variant="secondary" type="button" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button type="button" onClick={handleSend} disabled={sending || !canSend}>
            <Mail className="h-4 w-4" />
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
