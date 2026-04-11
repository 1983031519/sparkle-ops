import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  COMPANY, TERMS_AND_CONDITIONS,
  fmtDate, fmtCurrency, isoDatePart,
} from '@/lib/constants'
import type { Invoice, Estimate, Project, ProjectPhase, Client, InvoiceLineItem, EstimateLineItem, MaterialsSpecified } from '@/lib/database.types'

type DocType = 'invoice' | 'estimate' | 'project'
type PageStatus = 'loading' | 'not-found' | 'expired' | 'loaded'

interface DocLink {
  token: string
  document_type: DocType
  document_id: string
  expires_at: string
  viewed_at: string | null
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */

export default function ViewDocumentPage() {
  const { token } = useParams<{ token: string }>()
  const [status, setStatus] = useState<PageStatus>('loading')
  const [docType, setDocType] = useState<DocType | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [phases, setPhases] = useState<ProjectPhase[]>([])
  const [client, setClient] = useState<Client | null>(null)

  useEffect(() => {
    if (!token) { setStatus('not-found'); return }
    load(token)
  }, [token])

  async function load(tok: string) {
    // 1. Fetch the link row
    const { data: linkRaw } = await supabase
      .from('document_links')
      .select('token, document_type, document_id, expires_at, viewed_at')
      .eq('token', tok)
      .maybeSingle()

    if (!linkRaw) { setStatus('not-found'); return }
    const link = linkRaw as DocLink

    // 2. Check expiry
    if (new Date(link.expires_at) < new Date()) { setStatus('expired'); return }

    setDocType(link.document_type)

    // 3. Fetch the actual document + client
    let clientId: string | null = null

    if (link.document_type === 'invoice') {
      const { data } = await supabase.from('invoices').select('*').eq('id', link.document_id).maybeSingle()
      if (!data) { setStatus('not-found'); return }
      setInvoice(data as Invoice)
      clientId = (data as Invoice).client_id
    } else if (link.document_type === 'estimate') {
      const { data } = await supabase.from('estimates').select('*').eq('id', link.document_id).maybeSingle()
      if (!data) { setStatus('not-found'); return }
      setEstimate(data as Estimate)
      clientId = (data as Estimate).client_id
    } else if (link.document_type === 'project') {
      const [{ data: proj }, { data: ph }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', link.document_id).maybeSingle(),
        supabase.from('project_phases').select('*').eq('project_id', link.document_id).order('order_num'),
      ])
      if (!proj) { setStatus('not-found'); return }
      setProject(proj as Project)
      setPhases((ph ?? []) as ProjectPhase[])
      clientId = (proj as Project).client_id
    }

    if (clientId) {
      const { data: cl } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle()
      if (cl) setClient(cl as Client)
    }

    // 4. Record first view (fire-and-forget)
    if (!link.viewed_at) {
      fetch('/api/view-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tok }),
      }).catch(() => {})
    }

    setStatus('loaded')
  }

  /* ── render states ── */
  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: '#888', fontSize: 14 }}>
        Loading document…
      </div>
    )
  }

  if (status === 'not-found') {
    return (
      <Shell>
        <MessageCard
          title="Document Not Found"
          message="This link is invalid or the document has been removed. Please contact Sparkle Stone & Pavers if you believe this is an error."
        />
      </Shell>
    )
  }

  if (status === 'expired') {
    return (
      <Shell>
        <MessageCard
          title="Link Expired"
          message="This link has expired (links are valid for 7 days). To get an updated copy, please contact Sparkle Stone & Pavers at (941) 387-5133 or info@sparklestonepavers.com."
        />
      </Shell>
    )
  }

  return (
    <Shell>
      {docType === 'invoice'  && invoice  && <InvoiceView  inv={invoice}  client={client ?? undefined} />}
      {docType === 'estimate' && estimate && <EstimateView est={estimate} client={client ?? undefined} />}
      {docType === 'project'  && project  && <ProjectView  project={project} phases={phases} client={client ?? undefined} />}
    </Shell>
  )
}

/* ─── Shared Layout Shell ───────────────────────────────────────────────────── */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#F8F9FC', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top nav bar */}
      <div style={{ background: '#111827', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ color: '#4F6CF7', fontWeight: 700, fontSize: 16, letterSpacing: 0.3 }}>Sparkle Stone & Pavers</span>
          <span style={{ color: '#9CA3AF', fontSize: 11, marginLeft: 12 }}>{COMPANY.tagline}</span>
        </div>
        <a href={`tel:${COMPANY.phone}`} style={{ color: '#4F6CF7', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>{COMPANY.phone}</a>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px 48px' }}>
        {children}
      </div>
    </div>
  )
}

function MessageCard({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '48px 32px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <p style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>{title}</p>
      <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, maxWidth: 400, margin: '0 auto' }}>{message}</p>
      <a href="mailto:info@sparklestonepavers.com" style={{ display: 'inline-block', marginTop: 24, color: '#4F6CF7', fontWeight: 600, fontSize: 13 }}>info@sparklestonepavers.com</a>
    </div>
  )
}

/* ─── Document header shared by all types ───────────────────────────────────── */

function DocHeader({ title, number, dateLabel, dateValue, extra }: {
  title: string; number: string; dateLabel?: string; dateValue?: string; extra?: React.ReactNode
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
      {/* navy strip */}
      <div style={{ background: '#111827', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ color: '#4F6CF7', fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: 0.5 }}>{title}</p>
          <p style={{ color: '#9CA3AF', fontSize: 12, margin: '4px 0 0', fontFamily: 'monospace' }}>{number}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          {dateLabel && <p style={{ color: '#4F6CF7', fontSize: 12, margin: 0 }}>{dateLabel}: {dateValue}</p>}
          {extra}
        </div>
      </div>
      {/* company info */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0ede9', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#888' }}>{COMPANY.address}</span>
        <span style={{ fontSize: 12, color: '#888' }}>{COMPANY.phone} · {COMPANY.email}</span>
      </div>
    </div>
  )
}

/* ─── Card wrapper ───────────────────────────────────────────────────────────── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 12, ...style }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9a8f82', margin: '0 0 6px' }}>{children}</p>
}

function DocFooter() {
  return (
    <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: '#aaa', paddingTop: 12, borderTop: '1px solid #ebebeb' }}>
      {COMPANY.legal_name} · {COMPANY.tagline} · {COMPANY.address} · {COMPANY.phone} · {COMPANY.email}
    </div>
  )
}

/* ─── Invoice View ───────────────────────────────────────────────────────────── */

function InvoiceView({ inv, client }: { inv: Invoice; client?: Client }) {
  const items = inv.line_items as InvoiceLineItem[]
  const depositAmt = inv.deposit_received ?? 0
  const balanceDue = inv.balance_due ?? inv.total
  const method = inv.payment_method_used

  return (
    <div style={{ fontSize: 13, lineHeight: 1.65, color: '#333' }}>
      <DocHeader
        title="INVOICE"
        number={inv.number}
        dateLabel="Date"
        dateValue={fmtDate(isoDatePart(inv.created_at))}
        extra={
          <div>
            {inv.due_date && <p style={{ color: '#9CA3AF', fontSize: 11, margin: '2px 0 0' }}>Due: {fmtDate(inv.due_date)}</p>}
            <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: inv.status === 'Paid' ? '#f0fdf4' : inv.status === 'Overdue' ? '#fff1f2' : '#fffbeb', color: inv.status === 'Paid' ? '#16a34a' : inv.status === 'Overdue' ? '#e11d48' : '#d97706', border: `1px solid ${inv.status === 'Paid' ? '#bbf7d0' : inv.status === 'Overdue' ? '#fecdd3' : '#fde68a'}` }}>{inv.status}</span>
          </div>
        }
      />

      {/* Bill To */}
      <Card>
        <SectionLabel>Bill To</SectionLabel>
        <p style={{ fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{client?.name ?? 'N/A'}</p>
        {client?.address && <p style={{ color: '#555', margin: '2px 0' }}>{client.address}</p>}
        {client?.phone && <p style={{ color: '#555', margin: '2px 0' }}>{client.phone}</p>}
        {client?.email && <p style={{ color: '#555', margin: '2px 0' }}>{client.email}</p>}
        {inv.re_line && <p style={{ marginTop: 8 }}><span style={{ fontWeight: 600, color: '#111827' }}>RE:</span> {inv.re_line}</p>}
      </Card>

      {/* Line Items */}
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #d1d5db', textAlign: 'left' }}>
                <th style={{ padding: '8px 4px' }}>Description</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Qty</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Unit</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Unit Price</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #ebebeb', background: item.is_change_order ? '#fffbeb' : 'transparent' }}>
                  <td style={{ padding: '8px 4px' }}>{item.description}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.qty}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.unit}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>${item.unit_price.toFixed(2)}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>${(item.qty * item.unit_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ marginLeft: 'auto', width: 260, textAlign: 'right', marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>Subtotal</span><span>${inv.subtotal.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>Tax (0%)</span><span>$0.00</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #111827', paddingTop: 4, marginTop: 4, fontSize: 15, fontWeight: 700, color: '#111827' }}><span>Total</span><span>${inv.total.toFixed(2)}</span></div>
          {depositAmt > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#16a34a' }}><span>Deposit Received</span><span>−${depositAmt.toFixed(2)}</span></div>}
          {depositAmt > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #111827', paddingTop: 4, marginTop: 4, fontSize: 17, fontWeight: 700, color: '#111827' }}><span>Balance Due</span><span>${balanceDue.toFixed(2)}</span></div>}
        </div>
      </Card>

      {/* Payment */}
      <Card>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Payment Information</p>
        {method && <p style={{ color: '#333' }}>Payment Method: <strong>{method}</strong></p>}
        {inv.payment_terms && <p style={{ color: '#333' }}>Terms: <strong>{inv.payment_terms}</strong></p>}
        {method?.includes('Check') && <p style={{ fontSize: 11, color: '#888', marginTop: 6 }}>Check payable to: {COMPANY.check_payable}</p>}
        {method?.includes('Zelle') && <p style={{ fontSize: 11, color: '#888' }}>Zelle: {COMPANY.zelle}</p>}
        {method?.includes('ACH') && <p style={{ fontSize: 11, color: '#888' }}>ACH / Bank Transfer — contact us for details</p>}
      </Card>

      {inv.notes && <Card><p style={{ fontWeight: 600, color: '#111827', marginBottom: 4 }}>Notes</p><p style={{ color: '#555' }}>{inv.notes}</p></Card>}

      <SignatureLines />
      <DocFooter />
    </div>
  )
}

/* ─── Estimate View ──────────────────────────────────────────────────────────── */

function EstimateView({ est, client }: { est: Estimate; client?: Client }) {
  const mats = (est.materials_specified ?? {}) as MaterialsSpecified
  const items = est.line_items as EstimateLineItem[]
  const deposit = est.deposit_amount ?? est.total * 0.5
  const balance = est.balance_amount ?? est.total * 0.5

  return (
    <div style={{ fontSize: 13, lineHeight: 1.65, color: '#333' }}>
      <DocHeader
        title="PROPOSAL"
        number={est.number}
        dateLabel="Date"
        dateValue={fmtDate(isoDatePart(est.created_at))}
        extra={est.valid_until ? <p style={{ color: '#9CA3AF', fontSize: 11, margin: '4px 0 0' }}>Valid Until: {fmtDate(est.valid_until)}</p> : undefined}
      />

      {/* Prepared For / Job Site */}
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <SectionLabel>Prepared For</SectionLabel>
            <p style={{ fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{client?.name ?? 'N/A'}</p>
            {est.attn && <p style={{ color: '#555', margin: '2px 0' }}>Attn: {est.attn}</p>}
            {client?.address && <p style={{ color: '#555', margin: '2px 0' }}>{client.address}</p>}
            {client?.phone && <p style={{ color: '#555', margin: '2px 0' }}>{client.phone}</p>}
          </div>
          <div>
            {est.site_address && (
              <>
                <SectionLabel>Job Site</SectionLabel>
                <p style={{ margin: 0 }}>{est.site_address}</p>
              </>
            )}
            {est.division && <p style={{ marginTop: 6, fontSize: 12 }}><span style={{ color: '#9a8f82', fontWeight: 600 }}>Division:</span> {est.division}</p>}
          </div>
        </div>
        {est.re_line && <p style={{ marginTop: 12 }}><span style={{ fontWeight: 600, color: '#111827' }}>RE:</span> {est.re_line}</p>}
      </Card>

      {est.scope_of_work && (
        <Card>
          <p style={{ fontWeight: 600, color: '#111827', marginBottom: 4 }}>Scope of Work</p>
          <p style={{ color: '#444', whiteSpace: 'pre-wrap' }}>{est.scope_of_work}</p>
        </Card>
      )}

      {Object.values(mats).some(v => v) && (
        <Card>
          <p style={{ fontWeight: 600, color: '#111827', marginBottom: 8 }}>Materials Specified</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 4, fontSize: 12 }}>
            {mats.paver_type && <p><span style={{ color: '#9a8f82' }}>Type:</span> {mats.paver_type}</p>}
            {mats.paver_size && <p><span style={{ color: '#9a8f82' }}>Size:</span> {mats.paver_size}</p>}
            {mats.paver_color && <p><span style={{ color: '#9a8f82' }}>Color:</span> {mats.paver_color}</p>}
            {mats.sand_type && <p><span style={{ color: '#9a8f82' }}>Sand:</span> {mats.sand_type}</p>}
            {mats.sealant && <p><span style={{ color: '#9a8f82' }}>Sealant:</span> {mats.sealant}</p>}
            {mats.other && <p><span style={{ color: '#9a8f82' }}>Other:</span> {mats.other}</p>}
          </div>
        </Card>
      )}

      {(est.start_date || est.end_date) && (
        <Card>
          <p style={{ fontWeight: 600, color: '#111827', marginBottom: 4 }}>Timeline</p>
          <p style={{ color: '#444' }}>
            {est.start_date && <>Estimated Start: <strong>{fmtDate(est.start_date)}</strong></>}
            {est.start_date && est.end_date && ' — '}
            {est.end_date && <>Estimated Completion: <strong>{fmtDate(est.end_date)}</strong></>}
          </p>
        </Card>
      )}

      {/* Line Items */}
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #d1d5db', textAlign: 'left' }}>
                <th style={{ padding: '8px 4px' }}>Description</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Qty</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Unit</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Unit Price</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #ebebeb' }}>
                  <td style={{ padding: '8px 4px' }}>{item.description}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.qty}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.unit}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>${item.unit_price.toFixed(2)}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>${(item.qty * item.unit_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginLeft: 'auto', width: 240, textAlign: 'right', marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>Subtotal</span><span>${est.subtotal.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>Tax (0%)</span><span>$0.00</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #111827', paddingTop: 4, marginTop: 4, fontSize: 15, fontWeight: 700, color: '#111827' }}><span>Total</span><span>${est.total.toFixed(2)}</span></div>
        </div>
      </Card>

      {/* Payment */}
      <Card>
        <p style={{ fontWeight: 600, color: '#111827', marginBottom: 8 }}>Payment Terms</p>
        <p style={{ fontWeight: 600, color: '#333' }}>{est.payment_terms || '50% deposit + 50% on completion'}</p>
        <p style={{ color: '#333', marginTop: 4 }}>Deposit: <strong>${deposit.toFixed(2)}</strong> — Balance: <strong>${balance.toFixed(2)}</strong></p>
        <p style={{ marginTop: 10, fontSize: 12, color: '#555' }}>Accepted Payment Methods: {(est.accepted_payment_methods ?? ['Check', 'ACH', 'Zelle']).join(' · ')}</p>
        <p style={{ fontSize: 11, color: '#888' }}>Check payable to: {COMPANY.check_payable}</p>
        <p style={{ fontSize: 11, color: '#888' }}>Zelle: {COMPANY.zelle}</p>
      </Card>

      {est.warranty && <Card><p style={{ fontWeight: 600, color: '#111827', marginBottom: 4 }}>Warranty</p><p style={{ color: '#555', lineHeight: 1.7 }}>{est.warranty}</p></Card>}

      <Card>
        <p style={{ fontWeight: 600, color: '#111827', marginBottom: 6 }}>Terms & Conditions</p>
        <ol style={{ paddingLeft: 18, margin: 0 }}>
          {TERMS_AND_CONDITIONS.map((t, i) => <li key={i} style={{ fontSize: 12, color: '#555', lineHeight: 1.7, marginBottom: 2 }}>{t}</li>)}
        </ol>
      </Card>

      {est.notes && <Card><p style={{ fontWeight: 600, color: '#111827', marginBottom: 4 }}>Notes</p><p style={{ color: '#555' }}>{est.notes}</p></Card>}

      <SignatureLines acceptedBy="Accepted By" />
      <DocFooter />
    </div>
  )
}

/* ─── Project View ───────────────────────────────────────────────────────────── */

function ProjectView({ project: p, phases, client }: { project: Project; phases: ProjectPhase[]; client?: Client }) {
  const dep = p.total_value * (p.deposit_percent / 100)
  const mid = p.total_value * (p.mid_percent / 100)
  const fin = p.total_value * (p.final_percent / 100)
  const sitePhotos = (p.photos as string[]) ?? []

  return (
    <div style={{ fontSize: 13, lineHeight: 1.65, color: '#333' }}>
      <DocHeader
        title="PROJECT PROPOSAL"
        number={p.number}
        dateLabel="Date"
        dateValue={fmtDate(p.date ?? isoDatePart(p.created_at))}
        extra={p.valid_until ? <p style={{ color: '#9CA3AF', fontSize: 11, margin: '4px 0 0' }}>Valid Until: {fmtDate(p.valid_until)}</p> : undefined}
      />

      {/* Client + Site */}
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <SectionLabel>Prepared For</SectionLabel>
            <p style={{ fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{client?.name ?? p.client_name ?? 'N/A'}</p>
            {client?.address && <p style={{ color: '#555', margin: '2px 0' }}>{client.address}</p>}
            {client?.phone && <p style={{ color: '#555', margin: '2px 0' }}>{client.phone}</p>}
          </div>
          <div>
            {p.site_address && (
              <>
                <SectionLabel>Job Site</SectionLabel>
                <p style={{ margin: 0 }}>{p.site_address}</p>
              </>
            )}
            {p.division && <p style={{ marginTop: 6, fontSize: 12 }}><span style={{ color: '#9a8f82', fontWeight: 600 }}>Division:</span> {p.division}</p>}
          </div>
        </div>
      </Card>

      {/* Title + Description */}
      <Card>
        <h4 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>{p.title}</h4>
        {p.description && <p style={{ color: '#444', whiteSpace: 'pre-wrap', margin: 0 }}>{p.description}</p>}
      </Card>

      {/* Site photos */}
      {sitePhotos.length > 0 && (
        <Card>
          <SectionLabel>Site Photos</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {sitePhotos.map((url, i) => (
              <img key={i} src={url} alt="" style={{ width: '100%', maxHeight: 260, borderRadius: 6, objectFit: 'cover' }} />
            ))}
          </div>
        </Card>
      )}

      {/* Phases */}
      {phases.map(ph => (
        <Card key={ph.id}>
          <h5 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>PHASE {ph.order_num} — {ph.title}</h5>
          {ph.description && <p style={{ color: '#444', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{ph.description}</p>}
          {((ph.photos as string[]) ?? []).length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <SectionLabel>Phase Photos</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                {((ph.photos as string[]) ?? []).map((url, pi) => (
                  <img key={pi} src={url} alt="" style={{ width: '100%', maxHeight: 260, borderRadius: 6, objectFit: 'cover' }} />
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
            {ph.timeline && <p style={{ color: '#9a8f82', margin: 0 }}>Timeline: <strong style={{ color: '#444' }}>{ph.timeline}</strong></p>}
            {ph.show_value && ph.value != null && <p style={{ color: '#9a8f82', margin: 0 }}>Value: <strong style={{ color: '#444' }}>{fmtCurrency(ph.value)}</strong></p>}
          </div>
        </Card>
      ))}

      {/* Financial */}
      <Card>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Financial Summary</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', color: 'white', padding: '10px 16px', borderRadius: 6, fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
          <span>Total Project Value</span><span>{fmtCurrency(p.total_value)}</span>
        </div>
        <div style={{ background: '#f5f4f2', border: '1px solid #e8e6e2', borderRadius: 8, padding: 16 }}>
          <p style={{ fontWeight: 600, color: '#333', marginBottom: 8 }}>Payment Schedule</p>
          <p style={{ color: '#333' }}>Deposit ({p.deposit_percent}%): <strong>{fmtCurrency(dep)}</strong> — due upon signing</p>
          <p style={{ color: '#333' }}>Mid-project ({p.mid_percent}%): <strong>{fmtCurrency(mid)}</strong> — due upon phase completion</p>
          <p style={{ color: '#333' }}>Final ({p.final_percent}%): <strong>{fmtCurrency(fin)}</strong> — due upon project completion</p>
          <p style={{ marginTop: 10, fontSize: 12, color: '#555' }}>Payment Methods: {(p.accepted_payment_methods ?? []).join(' · ')}</p>
          <p style={{ fontSize: 11, color: '#888' }}>Check payable to: {COMPANY.check_payable}</p>
          <p style={{ fontSize: 11, color: '#888' }}>Zelle: {COMPANY.zelle}</p>
        </div>
      </Card>

      {p.warranty && <Card><p style={{ fontWeight: 600, color: '#111827', marginBottom: 4 }}>Warranty</p><p style={{ color: '#555', lineHeight: 1.7 }}>{p.warranty}</p></Card>}

      <Card>
        <p style={{ fontWeight: 600, color: '#111827', marginBottom: 6 }}>Terms & Conditions</p>
        <ol style={{ paddingLeft: 18, margin: 0 }}>
          {TERMS_AND_CONDITIONS.map((t, i) => <li key={i} style={{ fontSize: 12, color: '#555', lineHeight: 1.7, marginBottom: 2 }}>{t}</li>)}
        </ol>
      </Card>

      {p.notes && <Card><p style={{ fontWeight: 600, color: '#111827', marginBottom: 4 }}>Notes</p><p style={{ color: '#555' }}>{p.notes}</p></Card>}

      <SignatureLines acceptedBy="Accepted By" />
      <DocFooter />
    </div>
  )
}

/* ─── Signature block ────────────────────────────────────────────────────────── */

function SignatureLines({ acceptedBy = 'Received By' }: { acceptedBy?: string }) {
  return (
    <Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, paddingTop: 8 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9a8f82', marginBottom: 40 }}>Authorized By</p>
          <div style={{ borderTop: '1.5px solid #111827', marginBottom: 4 }} />
          <p style={{ fontSize: 12, color: '#1a1a1a' }}>{COMPANY.signatory} — {COMPANY.legal_name}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9a8f82', marginBottom: 40 }}>{acceptedBy}</p>
          <div style={{ borderTop: '1.5px solid #111827', marginBottom: 4 }} />
          <p style={{ fontSize: 12, color: '#1a1a1a' }}>Client Printed Name, Signature & Date</p>
        </div>
      </div>
    </Card>
  )
}
