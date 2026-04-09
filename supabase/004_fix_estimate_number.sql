-- Fix: ensure estimate_number column exists on estimates table
alter table public.estimates add column if not exists estimate_number text;

-- Make it unique if not already (ignore error if constraint exists)
DO $$
BEGIN
  ALTER TABLE public.estimates ADD CONSTRAINT estimates_estimate_number_key UNIQUE (estimate_number);
EXCEPTION WHEN duplicate_table THEN
  -- constraint already exists, skip
END $$;
