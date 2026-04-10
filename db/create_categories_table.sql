-- Create categories table for the admin dashboard
-- Run this in Supabase SQL editor or via a migration tool.

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'Merchant',
  items_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active',
  banner text DEFAULT 'Not Set',
  fixed_slots int NOT NULL DEFAULT 0,
  position_1_business_id text REFERENCES public."Business"(id),
  position_2_business_id text REFERENCES public."Business"(id),
  position_3_business_id text REFERENCES public."Business"(id),
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS categories_type_idx ON public.categories (type);
CREATE INDEX IF NOT EXISTS categories_status_idx ON public.categories (status);
