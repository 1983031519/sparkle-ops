-- Migration: Projects module
-- Run in Supabase SQL Editor

create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  number text not null,
  client_id uuid references public.clients(id),
  client_name text,
  title text not null,
  site_address text,
  division text default 'Pavers',
  status text default 'Draft' check (status in ('Draft', 'Sent', 'Approved', 'In Progress', 'Completed', 'Cancelled')),
  description text,
  total_value numeric default 0,
  payment_schedule text default 'Custom',
  payment_terms text,
  deposit_percent numeric default 30,
  mid_percent numeric default 40,
  final_percent numeric default 30,
  accepted_payment_methods text[] default '{"Check","ACH","Zelle"}',
  warranty text default '1 year workmanship warranty on all installed materials.',
  notes text,
  date date default current_date,
  valid_until date,
  created_at timestamptz default now()
);

create table if not exists public.project_phases (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade,
  order_num integer not null,
  title text not null,
  description text,
  timeline text,
  value numeric,
  show_value boolean default false,
  status text default 'Pending' check (status in ('Pending', 'In Progress', 'Completed')),
  photos text[] default '{}',
  notes text,
  created_at timestamptz default now()
);

-- Add project_id to jobs for linking
alter table public.jobs add column if not exists project_id uuid references public.projects(id);

alter table public.projects enable row level security;
alter table public.project_phases enable row level security;

create policy "Authenticated users can do everything on projects"
  on public.projects for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can do everything on project_phases"
  on public.project_phases for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
