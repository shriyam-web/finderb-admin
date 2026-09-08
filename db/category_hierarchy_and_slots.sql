-- Parent Category → Category → Subcategory, plus 5 fixed partner slots.
-- Safe to re-run. Existing 2-level data keeps working: current top-level
-- rows stay Categories (level 1); current children stay Subcategories (level 2).
-- New Parent Categories use level = 0.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS level int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS position_4_business_id text REFERENCES public."Business"(id),
  ADD COLUMN IF NOT EXISTS position_5_business_id text REFERENCES public."Business"(id);

UPDATE public.categories
SET level = 1
WHERE parent_id IS NULL
  AND COALESCE(level, 1) NOT IN (0);

UPDATE public.categories AS child
SET level = 2
WHERE child.parent_id IS NOT NULL
  AND COALESCE(child.level, 1) <> 0
  AND EXISTS (
    SELECT 1
    FROM public.categories AS parent
    WHERE parent.id = child.parent_id
      AND parent.parent_id IS NULL
      AND COALESCE(parent.level, 1) <> 0
  );

CREATE INDEX IF NOT EXISTS categories_level_idx ON public.categories (level);

NOTIFY pgrst, 'reload schema';
