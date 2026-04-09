export type ClientType = 'Homeowner' | 'HOA' | 'Builder' | 'Company' | 'Commercial' | 'Property Manager'
export type JobDivision = 'Pavers' | 'Stone'
export type JobStatus = 'Lead' | 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled'
export type EstimateStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined'
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue'
export type InventoryCategory = 'Bricks' | 'Slabs' | 'Tiles' | 'Sand' | 'Sealant'
export type ContactRole = 'Owner' | 'Manager' | 'AP' | 'Superintendent' | 'Other'
export type PreferredContact = 'Phone' | 'Email' | 'Text'

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

export interface Job {
  id: string
  title: string
  client_id: string
  client?: Client
  division: JobDivision
  status: JobStatus
  address: string | null
  scheduled_date: string | null
  completed_date: string | null
  description: string | null
  total_amount: number
  created_at: string
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
  line_items: EstimateLineItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  notes: string | null
  valid_until: string | null
  created_at: string
}

export interface InvoiceLineItem {
  description: string
  qty: number
  unit: string
  unit_price: number
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
  tax_rate: number
  tax_amount: number
  total: number
  notes: string | null
  due_date: string | null
  paid_date: string | null
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
    }
  }
}
