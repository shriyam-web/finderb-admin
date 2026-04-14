-- 🚀 Enhanced Categories Schema Update with Cache Refresh
-- Run this in Supabase SQL Editor to fix schema cache issues

-- 1. Add missing columns with proper defaults
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS symbol text DEFAULT 'Not Set',
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

-- 2. Force schema cache refresh (critical for client-side queries)
NOTIFY pgrst, 'reload schema';

-- 3. Verify column creation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'categories' 
    AND column_name = 'symbol'
  ) THEN
    RAISE NOTICE '✅ symbol column exists';
  ELSE
    RAISE EXCEPTION '❌ symbol column missing - migration failed';
  END IF;
END $$;

-- 4. Create performance index
CREATE INDEX IF NOT EXISTS categories_symbol_idx ON public.categories(symbol);
CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON public.categories(parent_id);

-- 5. Final cache sync (additional safety)
SELECT pg_reload_conf();

RAISE NOTICE '🎉 Schema migration complete with cache refresh. Test category updates now!';
