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
    title: "Public badges have their own merchant tab",
    body: "Open a merchant and use the Badges tab. Overview only lists which marks are on the public profile.\n\nA business that already qualifies gets the mark by itself. Auto keeps it on while they still qualify. On forces a mark onto the profile. Off hides it.\n\nBest in Category — rating 4 or above, at least 3 visible reviews, replies within about 4 hours, and profile completion above 90%.\nQuick reply — average lead reply within 1 hour, and at least 5 leads opened.\nHighly rated — public rating 4.7 or above, and at least 10 visible reviews.\nPopular this month — most profile views or most leads this month among active businesses in the same category and city.\nNew on FinderB — the listing went live fewer than 30 days ago.\nFinderB Trusted — only an admin can turn this on. It does not award itself.",
    published_at: "2026-10-18T02:40:00+05:30",
  },
  {
    title: "Broadcast permissions are split, and new owners cannot edit for 15 days",
    body: "Tab access now lists Broadcast Notification and Broadcast Email separately. Granting one does not grant the other.\n\nAfter an ownership transfer, the new owner cannot change the listing for 15 days: name, contact, photos, and other business details stay as they were. They can edit after that window. Reverse transfer still restores the previous login during those 15 days.",
    published_at: "2026-10-17T05:00:00+05:30",
  },
  {
    title: "Owners answer claims, and transfers can be reversed",
    body: "When someone asks to manage a listing, the request still arrives here. The current owner is also emailed, and the business app shows a high-priority notification.\n\nThe owner has 48 hours to approve or deny in Notifications. Their answer shows on the Ownership Requests card: approved, denied, or still waiting. If 48 hours pass with no answer, their buttons close and the card says the current business didn't respond. You then approve or deny.\n\nAfter you approve, the previous login is kept for 15 days. Open Can reverse and press Reverse transfer to give that login back. The new login stops working. After 15 days the transfer stays as it is.",
    published_at: "2026-10-17T04:50:00+05:30",
  },
  {
    title: "Four new sidebar queues",
    body: "Reviews, Change Requests, Ownership Requests, and Job Reports are in the sidebar. A new tab's name shines in colour for 30 days, then it looks like the other tabs. No sticker.\n\nReviews — decide anonymous reviews and open review reports.\nChange Requests — approve or reject a business name or category change.\nOwnership Requests — approve or deny someone claiming a listing. Approval emails the login details only to that person.\nJob Reports — review a reported job. Taking it down emails the business with your reason.\n\nIf a tab has something waiting, its sidebar row shows a count. The same count appears on every tab that has pending work.",
    published_at: "2026-10-17T01:20:00+05:30",
  },
  {
    title: "To-do opens the item, and signups show who joined",
    body: "Dashboard To-do is oldest first. Each row says how long it has been waiting, and a click opens that exact request: the merchant profile, the review, the change, the ownership claim, the job report, the job, or the draft.\n\nHow businesses joined shows self registration against profiles created in this panel, including the last eight weeks. A merchant's details say whether they signed up themselves or an admin created the profile.\n\nOlder listings stay untagged until new signups write the origin. Run supabase/business_onboard_source.sql if that column is not in the database yet.",
    published_at: "2026-10-17T01:50:00+05:30",
  },
  {
    title: "Your account access is restored",
    body: "You can now use your account again.",
    published_at: "2026-09-11T00:03:00+05:30",
  },
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
  const { data } = await supabase.from("admin_whats_new").select("title, body");
  const existing = (data || []) as Array<{ title: string; body: string }>;
  const titles = new Set(existing.map((row) => row.title));
  const missing = WHATS_NEW_SEEDS.filter((item) => !titles.has(item.title));
  if (missing.length) {
    await supabase.from("admin_whats_new").insert(missing);
  }
  const queues = WHATS_NEW_SEEDS.find((item) => item.title === "Four new sidebar queues");
  const stored = existing.find((row) => row.title === "Four new sidebar queues");
  if (queues && stored && stored.body.includes("New sticker")) {
    await supabase
      .from("admin_whats_new")
      .update({ body: queues.body })
      .eq("title", queues.title);
  }
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
