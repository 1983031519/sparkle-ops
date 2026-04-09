-- Fix estimate and invoice columns to match what the app actually sends.
-- Run this in Supabase SQL Editor.

-- Estimates: ensure all needed columns exist
alter table public.estimates add column if not exists estimate_number text;
alter table public.estimates add column if not exists subtotal numeric default 0;
alter table public.estimates add column if not exists total numeric default 0;
alter table public.estimates add column if not exists deposit_amount numeric default 0;
alter table public.estimates add column if not exists balance_amount numeric default 0;
alter table public.estimates add column if not exists line_items jsonb default '[]';

-- Invoices: ensure subtotal and total exist
alter table public.invoices add column if not exists subtotal numeric default 0;
alter table public.invoices add column if not exists total numeric default 0;
alter table public.invoices add column if not exists line_items jsonb default '[]';
