-- Migration: Payment Terms & Methods for Estimates + Invoices
-- Run in Supabase SQL Editor

alter table public.estimates add column if not exists payment_terms text default '50% deposit + 50% on completion';
alter table public.estimates add column if not exists accepted_payment_methods text[] default '{"Check","ACH","Zelle"}';

alter table public.invoices add column if not exists payment_terms text;
alter table public.invoices add column if not exists payment_method_used text;
alter table public.invoices add column if not exists deposit_received numeric default 0;
alter table public.invoices add column if not exists balance_due numeric;
