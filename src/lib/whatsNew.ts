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
  const removed = await removedWhatsNewTitles(supabase);
  await ensureWhatsNewSeeds(supabase, removed).catch(() => undefined);

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

  const entries: WhatsNewEntry[] = ((items || []) as WhatsNewItem[])
    .filter((item) => !removed.has(item.title))
    .map(
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

const RETIRED_WHATS_NEW_TITLES = ["Site Configurations is under Platform"];

const WHATS_NEW_SEEDS: Array<{
  title: string;
  body: string;
  published_at: string;
}> = [
  {
    title: "Business Promotions is a new tab under Payments",
    body: "Business Promotions is new. Its name shines in the sidebar for 30 days, the same way other new tabs do.\n\nOpen Payments, then Business Promotions. The page uses the admin theme, including dark mode. It has shop verifications, promotion orders, custom plans, package prices, and promotion payments.\n\nPayments & Subscriptions is still the plan ledger. Anyone who can open that tab can open Business Promotions. The name stops shining after 30 days.",
    published_at: "2026-11-09T11:40:00+05:30",
  },
  {
    title: "Change your password from profile or Settings",
    body: "Open Your profile, or the Settings tab, and press Change password.\n\nFinderB asks for your current password, then emails a 6-digit code. The new password opens only after that code. Type it twice. It needs at least 8 characters, letters and a number, plus an uppercase letter or a symbol. Common passwords are rejected.\n\nWhen it is saved, a confirmation email is sent. The new password is stored in the same secure form used at sign-in. You stay signed in on this browser.",
    published_at: "2026-10-18T13:50:00+05:30",
  },
  {
    title: "Search the whole panel from the top bar",
    body: "A search icon sits to the left of your role, next to the theme switch. Open it, or press Ctrl K.\n\nType a name, email, phone, city, business, or id. It looks through users, merchants, leads, payments, reviews, jobs, blogs, categories, places, broadcasts, requests, and the menus.\n\nPick a result and that tab opens. When the record can open, it opens too: a user, a merchant, a lead, a review, a job, or a draft.\n\nThe name column on Users stays fixed when you scroll right. Click a user's name to open their details.",
    published_at: "2026-10-18T05:35:00+05:30",
  },
  {
    title: "Admin sign-in is slower to attack",
    body: "Password sign-in now stops after 5 attempts in a minute, for that network and for that email address.\n\nThe email code can be sent again only after 60 seconds. That wait is on the server, so refreshing the page does not skip it. Five codes is the most one sign-in will email.\n\nFive wrong codes end that sign-in. Enter the password again to get a new code.\n\nA missing account takes the same time to reject as a wrong password.",
    published_at: "2026-10-18T03:30:00+05:30",
  },
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

async function removedWhatsNewTitles(supabase: SupabaseClient): Promise<Set<string>> {
  const titles = new Set(RETIRED_WHATS_NEW_TITLES);
  const { data, error } = await supabase.from("admin_whats_new_removed").select("title");
  if (error || !data) return titles;
  for (const row of data as Array<{ title?: string }>) {
    if (row.title) titles.add(row.title);
  }
  return titles;
}

async function ensureWhatsNewSeeds(
  supabase: SupabaseClient,
  removed: Set<string>,
): Promise<void> {
  if (removed.size) {
    await supabase.from("admin_whats_new").delete().in("title", [...removed]);
  }
  const { data } = await supabase.from("admin_whats_new").select("title, body");
  const existing = (data || []) as Array<{ title: string; body: string }>;
  const titles = new Set(existing.map((row) => row.title));
  const missing = WHATS_NEW_SEEDS.filter((item) => !titles.has(item.title) && !removed.has(item.title));
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
  const promo = WHATS_NEW_SEEDS.find((item) => item.title === "Business Promotions is a new tab under Payments");
  const storedPromo = existing.find((row) => row.title === promo?.title);
  if (promo && storedPromo && storedPromo.body !== promo.body) {
    await supabase
      .from("admin_whats_new")
      .update({ body: promo.body, published_at: promo.published_at })
      .eq("title", promo.title);
  }
}

export async function removeWhatsNewEntry(itemId: string): Promise<{ error: string | null }> {
  let token = "";
  try {
    const raw = localStorage.getItem("admin_session");
    token = raw ? String((JSON.parse(raw) as { token?: string }).token || "") : "";
  } catch {
    token = "";
  }
  const response = await fetch("/api/admin/whats-new", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "x-admin-session": token,
    },
    body: JSON.stringify({ id: itemId }),
  });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) return { error: body?.error || "That update could not be removed." };
  return { error: null };
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
