-- Sparkle Stone & Pavers - Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Clients
create table public.clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('Homeowner', 'HOA', 'Builder', 'Company', 'Commercial', 'Property Manager')),
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz default now()
);

-- Suppliers
create table public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz default now()
);

-- Jobs
create table public.jobs (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  client_id uuid references public.clients(id) on delete set null,
  division text not null check (division in ('Pavers', 'Stone')),
  status text not null default 'Lead' check (status in ('Lead', 'Scheduled', 'In Progress', 'Completed', 'Cancelled')),
  address text,
  scheduled_date date,
  completed_date date,
  description text,
  total_amount numeric(12,2) default 0,
  created_at timestamptz default now()
);

-- Estimates
create table public.estimates (
  id uuid primary key default uuid_generate_v4(),
  estimate_number text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Accepted', 'Declined')),
  line_items jsonb not null default '[]',
  subtotal numeric(12,2) default 0,
  tax_rate numeric(5,2) default 7,
  tax_amount numeric(12,2) default 0,
  total numeric(12,2) default 0,
  notes text,
  valid_until date,
  created_at timestamptz default now()
);

-- Invoices
create table public.invoices (
  id uuid primary key default uuid_generate_v4(),
  invoice_number text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  estimate_id uuid references public.estimates(id) on delete set null,
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Paid', 'Overdue')),
  line_items jsonb not null default '[]',
  subtotal numeric(12,2) default 0,
  tax_rate numeric(5,2) default 7,
  tax_amount numeric(12,2) default 0,
  total numeric(12,2) default 0,
  notes text,
  due_date date,
  paid_date date,
  created_at timestamptz default now()
);

-- Inventory
create table public.inventory (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null check (category in ('Bricks', 'Slabs', 'Tiles', 'Sand', 'Sealant')),
  supplier_id uuid references public.suppliers(id) on delete set null,
  quantity numeric(10,2) default 0,
  unit text not null default 'pcs',
  min_stock numeric(10,2) default 10,
  cost_per_unit numeric(10,2) default 0,
  location text,
  created_at timestamptz default now()
);

-- Client Contacts
create table public.client_contacts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete cascade,
  name text not null,
  role text,
  phone text,
  email text,
  preferred_contact text,
  notes text,
  created_at timestamptz default now()
);

-- Enable Row Level Security on all tables
alter table public.clients enable row level security;
alter table public.suppliers enable row level security;
alter table public.jobs enable row level security;
alter table public.estimates enable row level security;
alter table public.invoices enable row level security;
alter table public.inventory enable row level security;
alter table public.client_contacts enable row level security;

-- RLS policies: allow authenticated users full access
create policy "Authenticated users can do everything on clients" on public.clients for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users can do everything on suppliers" on public.suppliers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users can do everything on jobs" on public.jobs for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users can do everything on estimates" on public.estimates for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users can do everything on invoices" on public.invoices for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users can do everything on inventory" on public.inventory for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated users can do everything on client_contacts" on public.client_contacts for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
