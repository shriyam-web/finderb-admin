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
