-- Update categories table for symbols and sub-categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS symbol text DEFAULT 'Not Set';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id);
