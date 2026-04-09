-- Migration: Add client_contacts table
-- Run this in Supabase SQL Editor if you already ran the original migration.sql

create table if not exists public.client_contacts (
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

alter table public.client_contacts enable row level security;

create policy "Authenticated users can do everything on client_contacts"
  on public.client_contacts for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
