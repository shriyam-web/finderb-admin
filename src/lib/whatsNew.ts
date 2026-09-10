import type { SupabaseClient } from "@supabase/supabase-js";

export type WhatsNewItem = {
  id: string;
  title: string;
  body: string;
  published_at: string;
  created_by: string | null;
  created_at: string;
};

export type WhatsNewEntry = WhatsNewItem & {
  isRead: boolean;
  readAt: string | null;
};

type ReadRow = {
  item_id: string;
  read_at: string;
};

export async function fetchWhatsNewEntries(
  supabase: SupabaseClient,
  adminId: string,
): Promise<{ entries: WhatsNewEntry[]; unreadCount: number; error: string | null }> {
  await ensureWhatsNewSeeds(supabase).catch(() => undefined);

  const [{ data: items, error: itemsError }, { data: reads, error: readsError }] =
    await Promise.all([
      supabase
        .from("admin_whats_new")
        .select("id, title, body, published_at, created_by, created_at")
        .order("published_at", { ascending: false }),
      supabase
        .from("admin_whats_new_reads")
        .select("item_id, read_at")
        .eq("admin_id", adminId),
    ]);

  if (itemsError) {
    return {
      entries: [],
      unreadCount: 0,
      error: itemsError.message,
    };
  }
  if (readsError) {
    return {
      entries: [],
      unreadCount: 0,
      error: readsError.message,
    };
  }

  const readMap = new Map(
    ((reads || []) as ReadRow[]).map((row) => [row.item_id, row.read_at]),
  );

  const entries: WhatsNewEntry[] = ((items || []) as WhatsNewItem[]).map(
    (item) => {
      const readAt = readMap.get(item.id) ?? null;
      return {
        ...item,
        isRead: Boolean(readAt),
        readAt,
      };
    },
  );

  return {
    entries,
    unreadCount: entries.filter((entry) => !entry.isRead).length,
    error: null,
  };
}

const WHATS_NEW_SEEDS: Array<{
  title: string;
  body: string;
  published_at: string;
}> = [
  {
    title: "Controller actions auto-revoked after unlisted IP change",
    body: "Controller credentials were changed from an unlisted IP address. Controller actions have been automatically revoked.",
    published_at: "2026-09-10T21:00:00+05:30",
  },
  {
    title: "Category catalog: Parent → Category → Subcategory",
    body: "Categories now have three clear levels. Parent Category is a grouping folder (violet). Category is what merchants join (teal). Subcategory is a more specific type under a Category (amber).\n\nSubcategories sit in an accordion that starts collapsed. The add/edit form uses three cards instead of a Kind dropdown, shows the path preview, and lets you add a Category or Subcategory from the tree.",
    published_at: "2026-09-09T00:30:00+05:30",
  },
  {
    title: "Working hours match the merchant panel",
    body: "Merchant detail and Quick Onboard now use the same working-hours editor as the merchant dashboard: Open 24 hours, Closed, and Apply same to all days from Monday.",
    published_at: "2026-09-09T00:32:00+05:30",
  },
  {
    title: "Tab access and other dialogs stay on top",
    body: "The Manage Admins tab-access dialog, profile, jobs review, What's New, and onboard chooser now render above the sidebar and sticky header so they are no longer hidden behind chrome.",
    published_at: "2026-09-09T00:34:00+05:30",
  },
];

async function ensureWhatsNewSeeds(
  supabase: SupabaseClient,
): Promise<void> {
  const { data } = await supabase.from("admin_whats_new").select("title");
  const existing = new Set(
    ((data || []) as Array<{ title: string }>).map((row) => row.title),
  );
  const missing = WHATS_NEW_SEEDS.filter((item) => !existing.has(item.title));
  if (!missing.length) return;
  await supabase.from("admin_whats_new").insert(missing);
}

export async function markWhatsNewRead(
  supabase: SupabaseClient,
  adminId: string,
  itemId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("admin_whats_new_reads").upsert(
    {
      admin_id: adminId,
      item_id: itemId,
      read_at: new Date().toISOString(),
    },
    { onConflict: "admin_id,item_id" },
  );
  return { error: error?.message ?? null };
}

export async function markAllWhatsNewRead(
  supabase: SupabaseClient,
  adminId: string,
  itemIds: string[],
): Promise<{ error: string | null }> {
  if (!itemIds.length) return { error: null };
  const now = new Date().toISOString();
  const { error } = await supabase.from("admin_whats_new_reads").upsert(
    itemIds.map((itemId) => ({
      admin_id: adminId,
      item_id: itemId,
      read_at: now,
    })),
    { onConflict: "admin_id,item_id" },
  );
  return { error: error?.message ?? null };
}
