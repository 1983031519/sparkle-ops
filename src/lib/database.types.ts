export type ClientType = 'Homeowner' | 'HOA' | 'Builder' | 'Company' | 'Commercial' | 'Property Manager'
export type JobDivision = 'Pavers' | 'Stone'
export type JobStatus = 'Lead' | 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled'
export type EstimateStatus = 'Draft' | 'Sent' | 'Approved'
export type InvoiceStatus = 'Unpaid' | 'Paid' | 'Overdue'
export type InventoryCategory = 'Bricks' | 'Slabs' | 'Tiles' | 'Sand' | 'Sealant'
export type ContactRole = 'Owner' | 'Manager' | 'AP' | 'Superintendent' | 'Other'
export type PreferredContact = 'Phone' | 'Email' | 'Text'
export type ChangeOrderStatus = 'Pending Client Approval' | 'Approved' | 'Declined'

// ── Matches actual Supabase schema exactly ──

export interface Client {
  id: string
  name: string
  type: ClientType
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  contact_name: string | null
  notes: string | null
  created_at: string
}

export interface ClientContact {
  id: string
  client_id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  preferred_contact: string | null
  notes: string | null
  created_at: string
}

export interface MaterialsSpecified {
  paver_type?: string
  paver_size?: string
  paver_color?: string
  sand_type?: string
  sealant?: string
  other?: string
}

export interface EstimateLineItem {
  description: string
  qty: number
  unit: string
  unit_price: number
}

export interface Estimate {
  id: string
  number: string                  // DB column: "number" (NOT NULL)
  estimate_number: string | null  // DB column: "estimate_number" (nullable duplicate)
  client_id: string
  status: EstimateStatus
  division: string | null
  attn: string | null
  site_address: string | null
  re_line: string | null
  scope_of_work: string | null
  materials_specified: MaterialsSpecified | null
  start_date: string | null
  end_date: string | null
  line_items: EstimateLineItem[]
  subtotal: number
  total: number
  deposit_amount: number
  balance_amount: number
  warranty: string | null
  notes: string | null
  valid_until: string | null
  job_id: string | null
  created_at: string
}

export interface InvoiceLineItem {
  description: string
  qty: number
  unit: string
  unit_price: number
  is_change_order?: boolean
}

export interface Invoice {
  id: string
  number: string                  // DB column: "number"
  client_id: string
  job_id: string | null
  estimate_id: string | null
  status: InvoiceStatus
  line_items: InvoiceLineItem[]
  subtotal: number
  total: number
  notes: string | null
  due_date: string | null
  re_line: string | null
  created_at: string
}

export interface ChecklistItem {
  text: string
  done: boolean
}

export interface Job {
  id: string
  title: string
  client_id: string
  division: JobDivision
  status: JobStatus
  address: string | null
  site_address: string | null
  re_line: string | null
  start_date: string | null       // DB: "start_date" (was scheduled_date)
  end_date: string | null          // DB: "end_date" (was completed_date)
  notes: string | null             // DB: "notes" (was description)
  total: number                    // DB: "total" (was total_amount)
  estimate_id: string | null
  assigned_to: string | null
  materials_used: string | null
  checklist: ChecklistItem[]
  photos: string[]
  created_at: string
}

export interface ChangeOrder {
  id: string
  job_id: string
  date: string
  description: string
  reason: string | null
  qty: number
  unit: string
  unit_price: number
  total: number
  status: ChangeOrderStatus
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  record_type: string
  roles: string[]
  first_name: string | null
  last_name: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  category: string | null
  trade: string | null
  ein: string | null
  pay_type: string | null
  pay_rate: number | null
  payment_method: string | null
  requires_1099: boolean
  division: string | null
  start_date: string | null
  status: string
  account_number: string | null
  payment_terms: string | null
  role_title: string | null
  notes: string | null
  created_at: string
}

export interface InventoryItem {
  id: string
  name: string
  category: InventoryCategory
  supplier_id: string | null
  quantity: number
  unit: string
  low_stock_threshold: number      // DB: "low_stock_threshold" (was min_stock)
  unit_cost: number                // DB: "unit_cost" (was cost_per_unit)
  notes: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      clients: { Row: Client; Insert: Omit<Client, 'id' | 'created_at'>; Update: Partial<Omit<Client, 'id' | 'created_at'>> }
      jobs: { Row: Job; Insert: Omit<Job, 'id' | 'created_at'>; Update: Partial<Omit<Job, 'id' | 'created_at'>> }
      estimates: { Row: Estimate; Insert: Omit<Estimate, 'id' | 'created_at'>; Update: Partial<Omit<Estimate, 'id' | 'created_at'>> }
      invoices: { Row: Invoice; Insert: Omit<Invoice, 'id' | 'created_at'>; Update: Partial<Omit<Invoice, 'id' | 'created_at'>> }
      suppliers: { Row: Supplier; Insert: Omit<Supplier, 'id' | 'created_at'>; Update: Partial<Omit<Supplier, 'id' | 'created_at'>> }
      inventory: { Row: InventoryItem; Insert: Omit<InventoryItem, 'id' | 'created_at'>; Update: Partial<Omit<InventoryItem, 'id' | 'created_at'>> }
      client_contacts: { Row: ClientContact; Insert: Omit<ClientContact, 'id' | 'created_at'>; Update: Partial<Omit<ClientContact, 'id' | 'created_at'>> }
      change_orders: { Row: ChangeOrder; Insert: Omit<ChangeOrder, 'id' | 'created_at'>; Update: Partial<Omit<ChangeOrder, 'id' | 'created_at'>> }
    }
  }
}
