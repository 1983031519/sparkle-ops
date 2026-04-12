-- Expand inventory table to serve as a full business asset registry
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS brand_model text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS year_purchased integer;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS purchase_price numeric DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS current_market_value numeric;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS condition text DEFAULT 'Good';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS status text DEFAULT 'Active';

-- Relax category NOT NULL to allow new categories
-- Existing categories (Bricks, Slabs, etc.) become "Materials & Stock"
