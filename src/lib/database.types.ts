export type ClientType = 'Homeowner' | 'HOA' | 'Builder' | 'Company' | 'Commercial' | 'Property Manager'
export type JobDivision = 'Pavers' | 'Stone'
export type JobStatus = 'Lead' | 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled'
export type EstimateStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined'
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue'
export type InventoryCategory = 'Bricks' | 'Slabs' | 'Tiles' | 'Sand' | 'Sealant'
export type ContactRole = 'Owner' | 'Manager' | 'AP' | 'Superintendent' | 'Other'
export type PreferredContact = 'Phone' | 'Email' | 'Text'
export type ChangeOrderStatus = 'Pending Client Approval' | 'Approved' | 'Declined'

export interface Client {
  id: string
  name: string
  type: ClientType
  email: string | null
  phone: string | null
  address: string | null
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
  estimate_number: string
  client_id: string
  client?: Client
  job_id: string | null
  job?: Job
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
  invoice_number: string
  client_id: string
  client?: Client
  job_id: string | null
  job?: Job
  estimate_id: string | null
  status: InvoiceStatus
  line_items: InvoiceLineItem[]
  subtotal: number
  total: number
  notes: string | null
  due_date: string | null
  paid_date: string | null
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
  client?: Client
  division: JobDivision
  status: JobStatus
  address: string | null
  site_address: string | null
  re_line: string | null
  scheduled_date: string | null
  completed_date: string | null
  description: string | null
  total_amount: number
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
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export interface InventoryItem {
  id: string
  name: string
  category: InventoryCategory
  supplier_id: string | null
  supplier?: Supplier
  quantity: number
  unit: string
  min_stock: number
  cost_per_unit: number
  location: string | null
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
