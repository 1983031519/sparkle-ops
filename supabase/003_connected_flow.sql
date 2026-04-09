-- Migration: Connected flow - Estimate → Job → Invoice
-- Run this in Supabase SQL Editor

-- Add new columns to estimates
alter table public.estimates add column if not exists division text;
alter table public.estimates add column if not exists attn text;
alter table public.estimates add column if not exists site_address text;
alter table public.estimates add column if not exists re_line text;
alter table public.estimates add column if not exists scope_of_work text;
alter table public.estimates add column if not exists materials_specified jsonb default '{}';
alter table public.estimates add column if not exists start_date date;
alter table public.estimates add column if not exists end_date date;
alter table public.estimates add column if not exists warranty text default '1 year workmanship warranty on all installed materials.';
alter table public.estimates add column if not exists payment_schedule jsonb default '{}';

-- Add new columns to jobs
alter table public.jobs add column if not exists estimate_id uuid references public.estimates(id);
alter table public.jobs add column if not exists assigned_to text;
alter table public.jobs add column if not exists materials_used text;
alter table public.jobs add column if not exists checklist jsonb default '[]';
alter table public.jobs add column if not exists photos text[] default '{}';
alter table public.jobs add column if not exists site_address text;
alter table public.jobs add column if not exists re_line text;

-- Change orders table
create table if not exists public.change_orders (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references public.jobs(id) on delete cascade,
  date date default current_date,
  description text not null,
  reason text,
  qty numeric default 1,
  unit text default 'job',
  unit_price numeric default 0,
  total numeric default 0,
  status text default 'Pending Client Approval' check (status in ('Pending Client Approval', 'Approved', 'Declined')),
  created_at timestamptz default now()
);

alter table public.change_orders enable row level security;
create policy "Authenticated users can do everything on change_orders"
  on public.change_orders for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
