-- Add site_address column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS site_address text;
