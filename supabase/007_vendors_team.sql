-- Migration: Expand suppliers into Vendors & Team
-- Run this in Supabase SQL Editor

alter table public.suppliers add column if not exists record_type text default 'Company';
alter table public.suppliers add column if not exists roles text[] default '{}';
alter table public.suppliers add column if not exists first_name text;
alter table public.suppliers add column if not exists last_name text;
alter table public.suppliers add column if not exists trade text;
alter table public.suppliers add column if not exists ein text;
alter table public.suppliers add column if not exists pay_type text;
alter table public.suppliers add column if not exists pay_rate numeric;
alter table public.suppliers add column if not exists payment_method text;
alter table public.suppliers add column if not exists requires_1099 boolean default false;
alter table public.suppliers add column if not exists division text;
alter table public.suppliers add column if not exists start_date date;
alter table public.suppliers add column if not exists status text default 'Active';
alter table public.suppliers add column if not exists account_number text;
alter table public.suppliers add column if not exists payment_terms text;
alter table public.suppliers add column if not exists role_title text;

-- Backfill existing suppliers
UPDATE public.suppliers
SET record_type = 'Company', roles = ARRAY['Material Supplier'], status = 'Active'
WHERE record_type IS NULL OR roles = '{}';
