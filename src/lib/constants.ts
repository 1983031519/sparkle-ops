export const COMPANY = {
  legal_name: 'Sparkle Solutions LLC',
  brand: 'Sparkle Stone & Pavers',
  tagline: 'Brick Pavers \u00b7 Pool Decks \u00b7 Driveways \u00b7 Walkways',
  address: '14651 Westbrook Cir #210, Bradenton FL 34211',
  phone: '(941) 387-5133',
  email: 'sparklesolutionsgs@gmail.com',
  signatory: 'Oscar Rocha',
  zelle: 'sparklesolutionsgs@gmail.com',
  check_payable: 'Sparkle Solutions LLC',
} as const

export const CLIENT_TYPES = ['Homeowner', 'HOA', 'Builder', 'Company', 'Commercial', 'Property Manager'] as const
export const JOB_DIVISIONS = ['Pavers', 'Stone'] as const
export const JOB_STATUSES = ['Lead', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'] as const
export const ESTIMATE_STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined'] as const
export const INVOICE_STATUSES = ['Draft', 'Sent', 'Paid', 'Overdue'] as const
export const INVENTORY_CATEGORIES = ['Bricks', 'Slabs', 'Tiles', 'Sand', 'Sealant'] as const
export const CONTACT_ROLES = ['Owner', 'Manager', 'AP', 'Superintendent', 'Other'] as const
export const PREFERRED_CONTACTS = ['Phone', 'Email', 'Text'] as const
export const CHANGE_ORDER_STATUSES = ['Pending Client Approval', 'Approved', 'Declined'] as const
export const CHANGE_ORDER_REASONS = ['Area increase', 'Material change', 'Added service', 'Other'] as const

export const DEFAULT_WARRANTY = '1 year workmanship warranty on all installed materials.'

export const TERMS_AND_CONDITIONS = [
  'This proposal is valid for 30 days from the date issued.',
  'Any changes to the scope of work will require a written change order and may affect the price and timeline.',
  'Client is responsible for ensuring clear access to the work area on scheduled dates.',
  'Unforeseen conditions (buried roots, broken pipes, unstable base) will be communicated immediately and may require a change order.',
  'All debris will be collected and disposed of at an appropriate location.',
  'Sparkle Solutions LLC is not responsible for pre-existing damage to surrounding surfaces.',
] as const

export function paymentMethodsForClient(clientType: string): string {
  const nosCash = ['HOA', 'Company', 'Commercial']
  const methods = `Check \u00b7 ACH \u00b7 Zelle: ${COMPANY.zelle}`
  return nosCash.includes(clientType) ? methods : `${methods} \u00b7 Cash`
}

export function generateEstimateNumber(count: number): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}${d}-P-${String(count).padStart(3, '0')}`
}

export function generateInvoiceNumber(count: number): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}${d}-${String(count).padStart(3, '0')}`
}
