-- One What's New notice per title. Extra copies were counting as separate unreads.
-- Run in the Supabase SQL editor (or via DATABASE_URL).

INSERT INTO admin_whats_new_removed (title)
VALUES ('Admin changes show on the website and app after 15 minutes')
ON CONFLICT (title) DO NOTHING;

DELETE FROM admin_whats_new
WHERE title = 'Admin changes show on the website and app after 15 minutes';

WITH ranked AS (
  SELECT id, title,
         row_number() OVER (PARTITION BY title ORDER BY created_at ASC, id ASC) AS rn
  FROM admin_whats_new
),
keepers AS (
  SELECT id, title FROM ranked WHERE rn = 1
),
dupes AS (
  SELECT r.id AS dupe_id, k.id AS keep_id
  FROM ranked r
  JOIN keepers k ON k.title = r.title
  WHERE r.rn > 1
)
INSERT INTO admin_whats_new_reads (admin_id, item_id, read_at)
SELECT rd.admin_id, d.keep_id, min(rd.read_at)
FROM admin_whats_new_reads rd
JOIN dupes d ON d.dupe_id = rd.item_id
GROUP BY rd.admin_id, d.keep_id
ON CONFLICT (admin_id, item_id) DO NOTHING;

DELETE FROM admin_whats_new a
USING (
  SELECT id FROM (
    SELECT id,
           row_number() OVER (PARTITION BY title ORDER BY created_at ASC, id ASC) AS rn
    FROM admin_whats_new
  ) ranked
  WHERE rn > 1
) doomed
WHERE a.id = doomed.id;

CREATE UNIQUE INDEX IF NOT EXISTS admin_whats_new_title_key
  ON admin_whats_new (title);

NOTIFY pgrst, 'reload schema';
