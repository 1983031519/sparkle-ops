export const COMPANY = {
  legal_name: 'Sparkle Solutions LLC',
  brand: 'Sparkle Stone & Pavers',
  address: '14651 Westbrook Cir #210, Bradenton FL 34211',
  phone: '(941) 387-5133',
  email: 'sparklesolutionsgs@gmail.com',
  signatory: 'Oscar Rocha',
} as const

export const CLIENT_TYPES = ['Homeowner', 'HOA', 'Builder', 'Company', 'Commercial', 'Property Manager'] as const
export const JOB_DIVISIONS = ['Pavers', 'Stone'] as const
export const JOB_STATUSES = ['Lead', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'] as const
export const ESTIMATE_STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined'] as const
export const INVOICE_STATUSES = ['Draft', 'Sent', 'Paid', 'Overdue'] as const
export const INVENTORY_CATEGORIES = ['Bricks', 'Slabs', 'Tiles', 'Sand', 'Sealant'] as const
export const CONTACT_ROLES = ['Owner', 'Manager', 'AP', 'Superintendent', 'Other'] as const
export const PREFERRED_CONTACTS = ['Phone', 'Email', 'Text'] as const
