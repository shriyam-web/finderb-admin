-- Add position column to categories table
-- Run this in Supabase SQL editor

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS position int DEFAULT 0;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';

-- Update existing categories to have a default position if needed
-- UPDATE public.categories SET position = 0 WHERE position IS NULL;
