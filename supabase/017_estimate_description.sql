-- Add description column to estimates table
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS description text;
