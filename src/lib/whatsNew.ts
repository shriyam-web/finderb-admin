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

export const WHATS_NEW_PAGE_SIZE = 15;

function adminSessionHeaders(): Headers {
  let token = "";
  try {
    const raw = localStorage.getItem("admin_session");
    token = raw ? String((JSON.parse(raw) as { token?: string }).token || "") : "";
  } catch {
    token = "";
  }
  return new Headers({
    accept: "application/json",
    "x-admin-session": token,
  });
}

async function adminGet(path: string): Promise<{ data: unknown[] | null; error: string | null }> {
  const response = await fetch(`/api/admin/db/${path}`, {
    headers: adminSessionHeaders(),
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body
      ? String((body as { message?: string }).message || "")
      : "";
    return { data: null, error: message || "Could not load What's New." };
  }
  return { data: Array.isArray(body) ? body : [], error: null };
}

const emptyWhatsNew = (error: string | null) => ({
  entries: [] as WhatsNewEntry[],
  total: 0,
  unreadCount: 0,
  unreadIds: [] as string[],
  error,
});

export async function fetchWhatsNewEntries(
  supabase: SupabaseClient,
  adminId: string,
  options?: { limit?: number; seed?: boolean },
): Promise<{
  entries: WhatsNewEntry[];
  total: number;
  unreadCount: number;
  unreadIds: string[];
  error: string | null;
}> {
  const limit = Math.max(1, options?.limit ?? WHATS_NEW_PAGE_SIZE);
  if (options?.seed) {
    await ensureWhatsNewSeeds().catch(() => undefined);
  }
  const [removedRows, itemsResult, catalogResult, readsResult] = await Promise.all([
    adminGet("admin_whats_new_removed?select=title"),
    adminGet(
      `admin_whats_new?select=id,title,body,published_at,created_by,created_at&order=published_at.desc&limit=${limit}&published_at=lte.${encodeURIComponent(new Date().toISOString())}`,
    ),
    adminGet(
      `admin_whats_new?select=id,title,published_at&order=published_at.desc&published_at=lte.${encodeURIComponent(new Date().toISOString())}`,
    ),
    adminGet(
      `admin_whats_new_reads?select=item_id,read_at&admin_id=eq.${encodeURIComponent(adminId)}`,
    ),
  ]);
  const removed = new Set(RETIRED_WHATS_NEW_TITLES);
  for (const row of (removedRows.data || []) as Array<{ title?: string }>) {
    if (row.title) removed.add(row.title);
  }
  const items = itemsResult.data;
  const itemsError = itemsResult.error ? { message: itemsResult.error } : null;
  const catalog = catalogResult.data;
  const catalogError = catalogResult.error ? { message: catalogResult.error } : null;
  const reads = readsResult.data;
  const readsError = readsResult.error ? { message: readsResult.error } : null;

  if (itemsError) return emptyWhatsNew(itemsError.message);
  if (catalogError) return emptyWhatsNew(catalogError.message);
  if (readsError) return emptyWhatsNew(readsError.message);

  const readMap = new Map(
    ((reads || []) as ReadRow[]).map((row) => [row.item_id, row.read_at]),
  );

  const visibleCatalog = uniqueWhatsNewTitles(
    ((catalog || []) as Array<{ id: string; title: string; published_at?: string }>).filter(
      (item) => !removed.has(item.title) && isWhatsNewLive(item.published_at),
    ),
  );
  const readTitles = readWhatsNewTitles(
    ((catalog || []) as Array<{ id: string; title: string }>),
    readMap,
  );
  const unreadIds = visibleCatalog
    .filter((item) => !readTitles.has(item.title))
    .map((item) => item.id);

  const entries = uniqueWhatsNewTitles(
    ((items || []) as WhatsNewItem[]).filter(
      (item) => !removed.has(item.title) && isWhatsNewLive(item.published_at),
    ),
  ).map((item) => {
    const readAt = readMap.get(item.id) ?? null;
    return {
      ...item,
      isRead: readTitles.has(item.title),
      readAt,
    };
  });

  return {
    entries,
    total: visibleCatalog.length,
    unreadCount: unreadIds.length,
    unreadIds,
    error: null,
  };
}

function isWhatsNewLive(publishedAt: string | undefined): boolean {
  if (!publishedAt) return true;
  const time = Date.parse(publishedAt);
  return Number.isNaN(time) || time <= Date.now();
}

function uniqueWhatsNewTitles<T extends { title: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const row of rows) {
    if (seen.has(row.title)) continue;
    seen.add(row.title);
    unique.push(row);
  }
  return unique;
}

function readWhatsNewTitles(
  catalog: Array<{ id: string; title: string }>,
  readMap: Map<string, string>,
): Set<string> {
  const titleById = new Map(catalog.map((item) => [item.id, item.title]));
  const titles = new Set<string>();
  for (const itemId of readMap.keys()) {
    const title = titleById.get(itemId);
    if (title) titles.add(title);
  }
  return titles;
}

const RETIRED_WHATS_NEW_TITLES = ["Site Configurations is under Platform"];

const WHATS_NEW_SEEDS: Array<{
  title: string;
  body: string;
  published_at: string;
}> = [
  {
    title: "Set your profile photo, and sign out from the account menu",
    body: "Your photo is in the top bar, beside the theme switch. Open it to see your name, email, and role.\n\nSettings in that menu opens your profile. Choose a photo, drag and zoom the crop, then save it. You can change the photo or remove it later.\n\nSign out is in this same menu, under Settings.",
    published_at: "2026-11-21T22:00:00+05:30",
  },
  {
    title: "Hold a listing for later, or reject it with a reason",
    body: "On a pending listing you can put it on snooze or reject it. Both ask for a reason. Pick a suggestion, or write your own.\n\nSnooze moves the business to Ignored. It leaves the to-do list and the Merchants count. You can activate it later, or reject it from there.\n\nReject stores the reason on the business and takes it out of the queue.\n\nThe approval queue buttons read Approve, Snooze, and Reject.",
    published_at: "2026-11-21T22:00:00+05:30",
  },
  {
    title: "Check that assigned tabs match what an admin can open",
    body: "The tab access window groups the tabs and shows how many are edit, read, or hidden.\n\nAfter you set them, press Check access. A full match says 100% match. If something is off, it lists it straight away: assigned but hidden, visible but not assigned, or read where you chose edit.",
    published_at: "2026-11-21T22:00:00+05:30",
  },
  {
    title: "To-do is grouped, and the symbols are easier to see",
    body: "Dashboard To-do groups waiting work by tab and shows a short list. Open the full list in its own window when you want every group.\n\nEach row uses a symbol at a normal size. Snooze shows a sleeping face.",
    published_at: "2026-11-21T22:00:00+05:30",
  },
  {
    title: "The main numbers sit above the request cards",
    body: "Registered users, active partners, total leads, and weekly sign-ups come first on the dashboard.\n\nReviews, Change requests, Ownership requests, and Job reports sit under those four.",
    published_at: "2026-11-21T22:00:00+05:30",
  },
  {
    title: "Reported Businesses is a new sidebar tab",
    body: "Reported Businesses is in the sidebar under Requests.\n\nOpen it and the page says this feature is coming soon.",
    published_at: "2026-11-21T22:00:00+05:30",
  },
  {
    title: "What's New updates on its own",
    body: "What's New is realtime now. A new notice shows up by itself, and the unread count moves with it. You do not need to refresh the page.\n\nThe latest 15 notices open first. Press Load more for the older ones.",
    published_at: "2026-11-18T03:00:00+05:30",
  },
  {
    title: "Photos and videos are moving to Amazon S3",
    body: "FinderB is switching media storage to Amazon Web Services S3, leaving Cloudinary behind. The move is already underway and finishes soon.\n\nIf a photo or video breaks, or a page shows the wrong picture, report it to the developer right away.",
    published_at: "2026-11-18T02:35:00+05:30",
  },
  {
    title: "Reset a forgotten password from the sign-in page",
    body: "Forgot password? sits under the password field on the sign-in page.\n\nEnter the email on the admin account and press Email me a code. FinderB sends a 6-digit code. It expires in 15 minutes. Type the code, then a new password twice, and press Save password.\n\nThe new password needs at least 8 characters, letters and a number, plus an uppercase letter or a symbol. It cannot be the password you already use. You can ask for another code after 60 seconds. Five wrong codes end that reset.\n\nAn email that is missing or disabled gets the same notice, so the page does not say whether an account exists. When the password is saved, a confirmation email is sent. Sign in with the new password.\n\nThis is separate from Change password inside the panel, which still asks for the current password.",
    published_at: "2026-11-14T04:10:00+05:30",
  },
  {
    title: "Ads Request checks each ad before payment",
    body: "Ads Request is a new tab under Requests. Its name shines in the sidebar for 30 days.\n\nA verified business can make more than one ad. After the video is saved, that ad waits here. Payment stays closed until you approve it.\n\nOpen the video, the target, and the ad content. Approve it, deny it with a reason, or delete an unpaid request. Business verification is still on Business Promotions. Anyone who can open Business Promotions can open Ads Request.",
    published_at: "2026-11-09T15:50:00+05:30",
  },
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

/** Milliseconds until the next notice is allowed to appear. Null when nothing is waiting. */
export function nextWhatsNewPublishDelay(now = Date.now()): number | null {
  let next: number | null = null;
  for (const item of WHATS_NEW_SEEDS) {
    const time = Date.parse(item.published_at);
    if (Number.isNaN(time) || time <= now) continue;
    if (next == null || time < next) next = time;
  }
  return next == null ? null : next - now;
}

let whatsNewSeedsChecked = false;

async function adminSend(
  method: string,
  path: string,
  body?: unknown,
  prefer?: string,
): Promise<{ ok: boolean }> {
  const headers = adminSessionHeaders();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (prefer) headers.set("prefer", prefer);
  const response = await fetch(`/api/admin/db/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  return { ok: response.ok };
}

async function ensureWhatsNewSeeds(): Promise<void> {
  if (whatsNewSeedsChecked) return;
  whatsNewSeedsChecked = true;
  const removedRows = await adminGet("admin_whats_new_removed?select=title");
  const existing = await adminGet("admin_whats_new?select=title&limit=1000");
  if (existing.error || !existing.data) {
    whatsNewSeedsChecked = false;
    return;
  }
  const removed = new Set(RETIRED_WHATS_NEW_TITLES);
  for (const row of (removedRows.data || []) as Array<{ title?: string }>) {
    if (row.title) removed.add(row.title);
  }
  const titles = new Set((existing.data as Array<{ title: string }>).map((row) => row.title));
  const stale = [...removed].filter((title) => titles.has(title));
  if (stale.length) {
    const list = stale.map((title) => `"${title.replace(/"/g, '\\"')}"`).join(",");
    await adminSend("DELETE", `admin_whats_new?title=in.(${encodeURIComponent(list)})`);
  }
  const now = Date.now();
  const missing = WHATS_NEW_SEEDS.filter((item) => {
    if (titles.has(item.title) || removed.has(item.title)) return false;
    const time = Date.parse(item.published_at);
    return Number.isNaN(time) || time <= now;
  });
  const waiting = WHATS_NEW_SEEDS.some((item) => {
    if (removed.has(item.title) || titles.has(item.title)) return false;
    const time = Date.parse(item.published_at);
    return !Number.isNaN(time) && time > now;
  });
  if (waiting) whatsNewSeedsChecked = false;
  if (missing.length) {
    await adminSend(
      "POST",
      "admin_whats_new?on_conflict=title",
      missing,
      "resolution=ignore-duplicates,return=minimal",
    );
  }
  const patchTitles = [
    "Four new sidebar queues",
    "Business Promotions is a new tab under Payments",
  ];
  const storedPatches = await adminGet(
    `admin_whats_new?select=title,body&title=in.(${encodeURIComponent(patchTitles.map((title) => `"${title}"`).join(","))})`,
  );
  const storedByTitle = new Map(
    ((storedPatches.data || []) as Array<{ title: string; body: string }>).map((row) => [row.title, row.body]),
  );
  const queues = WHATS_NEW_SEEDS.find((item) => item.title === "Four new sidebar queues");
  const storedQueues = storedByTitle.get("Four new sidebar queues");
  if (queues && storedQueues?.includes("New sticker")) {
    await adminSend(
      "PATCH",
      `admin_whats_new?title=eq.${encodeURIComponent(queues.title)}`,
      { body: queues.body },
    );
  }
  const promo = WHATS_NEW_SEEDS.find((item) => item.title === "Business Promotions is a new tab under Payments");
  const storedPromo = promo ? storedByTitle.get(promo.title) : undefined;
  if (promo && storedPromo && storedPromo !== promo.body) {
    await adminSend(
      "PATCH",
      `admin_whats_new?title=eq.${encodeURIComponent(promo.title)}`,
      { body: promo.body, published_at: promo.published_at },
    );
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

/** Hear a revision bump, then reload What's New through the signed-in admin proxy. */
export function subscribeWhatsNewChanges(
  supabase: SupabaseClient,
  onChange: () => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const notify = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => onChange(), 200);
  };
  const channel = supabase
    .channel(`whats-new-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "admin_whats_new_signal" },
      () => notify(),
    )
    .subscribe();
  return () => {
    if (timer) clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
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
