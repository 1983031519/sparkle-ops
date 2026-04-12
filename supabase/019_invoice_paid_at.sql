-- Add paid_at timestamp to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Backfill legacy imports: set paid_at and fix date to the actual invoice date
UPDATE invoices
SET paid_at = due_date::timestamptz,
    date = due_date
WHERE notes LIKE 'Imported from legacy archive:%'
AND status = 'Paid';
