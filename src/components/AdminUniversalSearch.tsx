"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "../../utils/supabase/client";
import {
  clipText,
  makeSearchDoc,
  searchDocs,
  tabSearchDoc,
  type SearchDoc,
  type SearchHit,
} from "../lib/adminSearch";
import Momo, { type MomoMood } from "./Momo";

type Row = Record<string, unknown>;

function text(row: object | null | undefined, key: string): string {
  if (!row) return "";
  const value = (row as Record<string, unknown>)[key];
  if (value == null) return "";
  return String(value);
}

function momoHello(): string {
  const hour = new Date().getHours();
  if (hour < 5 || hour >= 21) return "Still up? I'm Momo.";
  if (hour < 12) return "Good morning. I'm Momo.";
  if (hour < 17) return "Good afternoon. I'm Momo.";
  return "Good evening. I'm Momo.";
}

function Highlight({ text: value, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (needle.length < 2) return <>{value}</>;
  const at = value.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return <>{value}</>;
  return (
    <>
      {value.slice(0, at)}
      <mark>{value.slice(at, at + needle.length)}</mark>
      {value.slice(at + needle.length)}
    </>
  );
}

export default function AdminUniversalSearch({
  adminId,
  tabs,
  canViewFinancialData,
  users,
  merchants,
  pendingMerchants,
  businesses,
  leads,
  categories,
  movies,
  places,
  blogs,
  jobs,
  news,
  admins,
  payments,
  todos,
  onOpen,
}: {
  adminId: string | null;
  tabs: string[];
  canViewFinancialData: boolean;
  users: object[];
  merchants: object[];
  pendingMerchants: object[];
  businesses: object[];
  leads: object[];
  categories: object[];
  movies: object[];
  places: object[];
  blogs: object[];
  jobs: object[];
  news: object[];
  admins: object[];
  payments: object[];
  todos: object[];
  onOpen: (hit: SearchHit) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [remoteDocs, setRemoteDocs] = useState<SearchDoc[]>([]);
  const [reviewDocs, setReviewDocs] = useState<SearchDoc[]>([]);
  const [remoteReady, setRemoteReady] = useState(false);
  const [idle, setIdle] = useState<MomoMood>("look");
  const [idleEpoch, setIdleEpoch] = useState(0);
  const [reacting, setReacting] = useState(false);
  const momoHover = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [popBox, setPopBox] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const businessesRef = useRef(businesses);
  businessesRef.current = businesses;

  const localDocs = useMemo(() => {
    const docs: SearchDoc[] = tabs.map((name) => tabSearchDoc(name));
    const businessById = new Map<string, object>();
    for (const business of businesses) {
      const id = text(business, "id");
      if (id) businessById.set(id, business);
    }

    for (const user of users) {
      const id = text(user, "id");
      const name = text(user, "fullName") || "Unnamed user";
      docs.push(
        makeSearchDoc({
          key: `user:${id}`,
          kind: "User",
          focusKind: "user",
          tab: "Users",
          title: name,
          subtitle: [text(user, "email"), text(user, "phone")].filter(Boolean).join(" · "),
          targetId: id,
          extra: [text(user, "email"), text(user, "phone"), id, text(user, "authProvider")],
        }),
      );
    }

    const indexedBusinesses = new Set<string>();
    const pushMerchant = (merchant: object, pending: boolean) => {
      const id = text(merchant, "id");
      if (id) indexedBusinesses.add(id);
      const business = businessById.get(id);
      const name = text(merchant, "name") || "Merchant";
      docs.push(
        makeSearchDoc({
          key: `merchant:${id}`,
          kind: pending ? "Pending merchant" : "Merchant",
          focusKind: "merchant",
          tab: "Merchants",
          title: name,
          subtitle: [
            text(merchant, "category"),
            [text(merchant, "city"), text(merchant, "state")].filter(Boolean).join(", "),
            text(merchant, "phone") || text(business || {}, "mobile"),
          ]
            .filter(Boolean)
            .join(" · "),
          targetId: id,
          extra: [
            text(merchant, "email"),
            text(merchant, "phone"),
            text(merchant, "city"),
            text(merchant, "state"),
            text(merchant, "category"),
            text(merchant, "registrationNumber"),
            text(merchant, "slug"),
            text(merchant, "status"),
            text(merchant, "selectedPlan"),
            id,
            text(business || {}, "fullName"),
            text(business || {}, "owner_name"),
            text(business || {}, "owner_mobile"),
            text(business || {}, "workEmail"),
            text(business || {}, "publicPhone"),
            text(business || {}, "mobile"),
            text(business || {}, "businessAddress"),
            text(business || {}, "location"),
            text(business || {}, "panNumber"),
            text(business || {}, "aadharNumber"),
            text(business || {}, "cinNumber"),
            text(business || {}, "registrationNumber"),
            text(business || {}, "slug"),
          ],
        }),
      );
    };
    merchants.forEach((merchant) => pushMerchant(merchant, false));
    pendingMerchants.forEach((merchant) => {
      if (merchants.some((row) => text(row, "id") === text(merchant, "id"))) return;
      pushMerchant(merchant, true);
    });
    for (const business of businesses) {
      const id = text(business, "id");
      if (!id || indexedBusinesses.has(id)) continue;
      const status = text(business, "status").toLowerCase();
      const kind = status === "ignored" ? "Ignored listing" : status === "rejected" ? "Rejected listing" : "Merchant";
      docs.push(
        makeSearchDoc({
          key: `merchant:${id}`,
          kind,
          focusKind: "merchant",
          tab: "Merchants",
          title: text(business, "businessName") || text(business, "fullName") || "Merchant",
          subtitle: [
            text(business, "category"),
            [text(business, "city"), text(business, "state")].filter(Boolean).join(", "),
            text(business, "status"),
          ].filter(Boolean).join(" · "),
          targetId: id,
          extra: [
            text(business, "workEmail"),
            text(business, "email"),
            text(business, "publicPhone"),
            text(business, "mobile"),
            text(business, "owner_name"),
            text(business, "owner_mobile"),
            text(business, "slug"),
            text(business, "registrationNumber"),
            text(business, "listingHoldReason"),
            text(business, "status"),
            id,
          ],
        }),
      );
    }

    for (const lead of leads) {
      const id = text(lead, "id");
      docs.push(
        makeSearchDoc({
          key: `lead:${id}`,
          kind: "Lead",
          focusKind: "lead",
          tab: "Leads",
          title: text(lead, "name") || "Lead",
          subtitle: [text(lead, "phone"), text(lead, "email"), text(lead, "category")].filter(Boolean).join(" · "),
          targetId: id,
          extra: [
            text(lead, "email"),
            text(lead, "phone"),
            text(lead, "category"),
            text(lead, "merchant_name"),
            text(lead, "status"),
            text(lead, "source"),
            clipText(text(lead, "message")),
            id,
          ],
        }),
      );
    }

    const categoryName = new Map<string, string>();
    for (const category of categories) {
      const id = text(category, "id");
      if (id) categoryName.set(id, text(category, "name"));
    }
    for (const category of categories) {
      const id = text(category, "id");
      const parent = categoryName.get(text(category, "parent_id"));
      docs.push(
        makeSearchDoc({
          key: `category:${id}`,
          kind: "Category",
          focusKind: "category",
          tab: "Categories",
          title: text(category, "name") || "Category",
          subtitle: [parent, text(category, "type") || text(category, "status")].filter(Boolean).join(" · "),
          targetId: id,
          extra: [parent, text(category, "status"), text(category, "type"), id],
        }),
      );
    }

    for (const movie of movies) {
      const id = text(movie, "id");
      docs.push(
        makeSearchDoc({
          key: `movie:${id}`,
          kind: "Movie",
          focusKind: "movie",
          tab: "Movies",
          title: text(movie, "name") || "Movie",
          subtitle: clipText(text(movie, "description"), 80),
          targetId: id,
          extra: [clipText(text(movie, "description")), id],
        }),
      );
    }

    for (const place of places) {
      const id = text(place, "id");
      docs.push(
        makeSearchDoc({
          key: `place:${id}`,
          kind: "Tourist place",
          focusKind: "place",
          tab: "Tourist Places",
          title: text(place, "name") || "Place",
          subtitle: [text(place, "location"), text(place, "category")].filter(Boolean).join(" · "),
          targetId: id,
          extra: [text(place, "location"), text(place, "category"), clipText(text(place, "description")), id],
        }),
      );
    }

    for (const blog of blogs) {
      const id = text(blog, "id");
      const rawTags = (blog as Row).tags;
      const tags = Array.isArray(rawTags) ? rawTags.map((tag) => String(tag)) : [];
      docs.push(
        makeSearchDoc({
          key: `blog:${id}`,
          kind: "Blog",
          focusKind: "blog",
          tab: "Blogs",
          title: text(blog, "title") || "Blog",
          subtitle: [text(blog, "category"), text(blog, "status"), text(blog, "author")].filter(Boolean).join(" · "),
          targetId: id,
          extra: [text(blog, "slug"), text(blog, "excerpt"), text(blog, "author"), text(blog, "category"), ...tags, id],
        }),
      );
    }

    for (const job of jobs) {
      const id = text(job, "id");
      const business = (job as Row).Business;
      const businessName =
        business && typeof business === "object"
          ? text(business as object, "businessName")
          : "";
      docs.push(
        makeSearchDoc({
          key: `job:${id}`,
          kind: "Job",
          focusKind: "job",
          tab: "FinderB Jobs",
          title: text(job, "title") || "Job",
          subtitle: [businessName, text(job, "location"), text(job, "type")].filter(Boolean).join(" · "),
          targetId: id,
          extra: [
            businessName,
            text(job, "location"),
            text(job, "type"),
            text(job, "department"),
            text(job, "status"),
            text(job, "approval_status"),
            clipText(text(job, "description")),
            id,
          ],
        }),
      );
    }

    for (const item of news) {
      const id = text(item, "id");
      docs.push(
        makeSearchDoc({
          key: `news:${id}`,
          kind: "News",
          focusKind: "news",
          tab: "News",
          title: text(item, "title") || "News",
          subtitle: text(item, "author"),
          targetId: id,
          extra: [clipText(text(item, "content"), 180), text(item, "author"), id],
        }),
      );
    }

    for (const admin of admins) {
      const id = text(admin, "id");
      docs.push(
        makeSearchDoc({
          key: `admin:${id}`,
          kind: "Admin",
          focusKind: "admin",
          tab: "Manage Admins",
          title: text(admin, "display_name") || text(admin, "email") || "Admin",
          subtitle: [text(admin, "email"), text(admin, "role").replace(/_/g, " ")].filter(Boolean).join(" · "),
          targetId: id,
          extra: [text(admin, "email"), text(admin, "display_name"), text(admin, "role"), id],
        }),
      );
    }

    for (const todo of todos) {
      const id = text(todo, "id");
      const tab = text(todo, "tab");
      if (!tab) continue;
      docs.push(
        makeSearchDoc({
          key: `todo:${id}`,
          kind: "Queue",
          focusKind: text(todo, "kind") || "queue",
          tab,
          title: text(todo, "title") || "Queue item",
          subtitle: text(todo, "detail"),
          targetId: text(todo, "targetId") || null,
          extra: [text(todo, "detail"), text(todo, "kind"), tab],
        }),
      );
    }

    if (canViewFinancialData) {
      payments.forEach((payment, index) => {
        const id = text(payment, "id") || text(payment, "payment_id") || `payment-${index}`;
        const businessName =
          text(payment, "business_name") ||
          text(payment, "businessName") ||
          text(businessById.get(text(payment, "business_id")) || {}, "businessName");
        docs.push(
          makeSearchDoc({
            key: `payment:${id}`,
            kind: "Payment",
            focusKind: "payment",
            tab: "Payments & Subscriptions",
            title: businessName || text(payment, "payment_id") || "Payment",
            subtitle: [text(payment, "status"), text(payment, "payment_id"), text(payment, "selected_plan") || text(payment, "plan")]
              .filter(Boolean)
              .join(" · "),
            targetId: text(payment, "business_id") || null,
            extra: [
              text(payment, "payment_id"),
              text(payment, "razorpay_payment_id"),
              text(payment, "razorpay_subscription_id"),
              text(payment, "status"),
              text(payment, "amount_paise"),
              businessName,
              id,
            ],
          }),
        );
      });
    }

    if (tabs.includes("Settings")) {
      for (const item of [
        ["password", "Password", "Change the password for this admin"],
        ["pin", "Panel PIN", "Change the 4-digit panel PIN"],
        ["compression", "Image Compression", "Store compressed images"],
        ["login", "Login Activity", "Recent admin sign-ins"],
        ["mode", "Website mode", "Live, text only, or maintenance"],
      ]) {
        docs.push(
          makeSearchDoc({
            key: `settings:${item[0]}`,
            kind: "Settings",
            focusKind: "tab",
            tab: "Settings",
            title: item[1],
            subtitle: item[2],
          }),
        );
      }
    }

    if (tabs.includes("Site Configurations")) {
      for (const item of [
        ["Media", "Photo storage", "Cloudinary or Amazon S3"],
        ["Plans", "Plan prices", "Growth monthly and Pro annual"],
        ["Promote", "Promote your business online", "Promotion switch and package prices"],
        ["Contact", "Public contact", "Company, email, phone, and address"],
      ]) {
        docs.push(
          makeSearchDoc({
            key: `site:${item[0]}`,
            kind: "Site config",
            focusKind: "site-config",
            tab: "Site Configurations",
            title: item[1],
            subtitle: item[2],
            targetId: item[0],
          }),
        );
      }
    }

    return docs;
  }, [
    tabs,
    users,
    merchants,
    pendingMerchants,
    businesses,
    leads,
    categories,
    movies,
    places,
    blogs,
    jobs,
    news,
    admins,
    payments,
    todos,
    canViewFinancialData,
  ]);

  const tabKey = tabs.join("|");

  useEffect(() => {
    if (!open || !adminId || remoteReady) return;
    let cancelled = false;
    const allowed = new Set(tabsRef.current);
    const load = async () => {
      const docs: SearchDoc[] = [];
      const tasks: Array<Promise<void>> = [];

      if (allowed.has("YouTube Playlists")) {
        tasks.push(
          (async () => {
            const supabase = createClient();
            const [{ data: playlists }, { data: videos }] = await Promise.all([
              supabase.from("youtube_playlists").select("id, title, description").limit(300),
              supabase.from("youtube_videos").select("id, title, topic, playlist_id").limit(800),
            ]);
            for (const row of playlists || []) {
              docs.push(
                makeSearchDoc({
                  key: `yt-playlist:${row.id}`,
                  kind: "Playlist",
                  focusKind: "playlist",
                  tab: "YouTube Playlists",
                  title: row.title || "Playlist",
                  subtitle: clipText(row.description, 80),
                  targetId: row.id,
                  extra: [row.description, row.id],
                }),
              );
            }
            for (const row of videos || []) {
              docs.push(
                makeSearchDoc({
                  key: `yt-video:${row.id}`,
                  kind: "Video",
                  focusKind: "video",
                  tab: "YouTube Playlists",
                  title: row.title || "Video",
                  subtitle: row.topic || "YouTube video",
                  targetId: row.playlist_id,
                  extra: [row.topic, row.id],
                }),
              );
            }
          })(),
        );
      }

      const pull = async (tab: string, url: string, read: (json: Row) => Row[]) => {
        if (!allowed.has(tab)) return;
        const res = await fetch(url, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as Row | null;
        if (!json || json.success === false) return;
        for (const row of read(json)) {
          docs.push(row as unknown as SearchDoc);
        }
      };

      if (allowed.has("Broadcasts")) {
        tasks.push(
          pull("Broadcasts", `/api/admin/broadcasts?adminId=${encodeURIComponent(adminId)}`, (json) => {
            const rows = Array.isArray(json.broadcasts) ? (json.broadcasts as Row[]) : [];
            return rows.map((row) =>
              makeSearchDoc({
                key: `broadcast:${text(row, "id")}`,
                kind: "Broadcast",
                focusKind: "broadcast",
                tab: "Broadcasts",
                title: text(row, "title") || "Broadcast",
                subtitle: clipText(text(row, "message"), 90),
                targetId: text(row, "id"),
                extra: [text(row, "message"), text(row, "target_label"), text(row, "status")],
              }),
            ) as unknown as Row[];
          }),
        );
      }

      if (allowed.has("Change Requests")) {
        tasks.push(
          pull(
            "Change Requests",
            `/api/admin/change-requests?adminId=${encodeURIComponent(adminId)}&status=all`,
            (json) => {
              const rows = Array.isArray(json.rows) ? (json.rows as Row[]) : [];
              return rows.map((row) =>
                makeSearchDoc({
                  key: `change:${text(row, "id")}`,
                  kind: "Change request",
                  focusKind: "change-request",
                  tab: "Change Requests",
                  title: text(row, "business_name") || text(row, "display_name") || "Change request",
                  subtitle: [text(row, "field"), text(row, "status")].filter(Boolean).join(" · "),
                  targetId: text(row, "id"),
                  extra: [
                    text(row, "field"),
                    text(row, "current_value"),
                    text(row, "requested_value"),
                    text(row, "city"),
                    text(row, "merchant_note"),
                  ],
                }),
              ) as unknown as Row[];
            },
          ),
        );
      }

      if (allowed.has("Ownership Requests")) {
        tasks.push(
          pull(
            "Ownership Requests",
            `/api/admin/ownership-requests?adminId=${encodeURIComponent(adminId)}&status=all`,
            (json) => {
              const rows = Array.isArray(json.rows) ? (json.rows as Row[]) : [];
              return rows.map((row) =>
                makeSearchDoc({
                  key: `owner:${text(row, "id")}`,
                  kind: "Ownership request",
                  focusKind: "ownership",
                  tab: "Ownership Requests",
                  title: text(row, "business_name") || "Ownership request",
                  subtitle: [text(row, "requester_name"), text(row, "status")].filter(Boolean).join(" · "),
                  targetId: text(row, "id"),
                  extra: [
                    text(row, "requester_name"),
                    text(row, "requester_email"),
                    text(row, "requester_phone"),
                    text(row, "city"),
                    text(row, "status"),
                  ],
                }),
              ) as unknown as Row[];
            },
          ),
        );
      }

      if (allowed.has("Job Reports")) {
        tasks.push(
          pull(
            "Job Reports",
            `/api/admin/job-reports?adminId=${encodeURIComponent(adminId)}&status=all`,
            (json) => {
              const rows = Array.isArray(json.rows) ? (json.rows as Row[]) : [];
              return rows.map((row) =>
                makeSearchDoc({
                  key: `report:${text(row, "id")}`,
                  kind: "Job report",
                  focusKind: "job-report",
                  tab: "Job Reports",
                  title: text(row, "job_title") || "Job report",
                  subtitle: [text(row, "reason"), text(row, "status")].filter(Boolean).join(" · "),
                  targetId: text(row, "id"),
                  extra: [text(row, "reason"), text(row, "status"), text(row, "job_id")],
                }),
              ) as unknown as Row[];
            },
          ),
        );
      }

      const nameOf = (id: string) => {
        const row = businessesRef.current.find((item) => text(item, "id") === id);
        return row ? text(row, "businessName") || text(row, "fullName") : "";
      };

      if (allowed.has("Ads Request") || allowed.has("Business Promotions")) {
        tasks.push(
          (async () => {
            const supabase = createClient();
            const [ordersRes, verifyRes, packageRes, customRes] = await Promise.all([
              supabase
                .from("promotion_orders")
                .select("id, business_id, package_id, package_snapshot, target_area, target_pincode, payment_status, campaign_status, ad_review_status, amount_inr, razorpay_payment_id, video_public_id, video_url")
                .order("created_at", { ascending: false })
                .limit(200),
              allowed.has("Business Promotions")
                ? supabase.from("business_verifications").select("id, business_id, status, rejection_reason").order("created_at", { ascending: false }).limit(200)
                : Promise.resolve({ data: [] as Row[] }),
              allowed.has("Business Promotions")
                ? supabase.from("promotion_packages").select("id, name, price_inr, coverage_label, active")
                : Promise.resolve({ data: [] as Row[] }),
              allowed.has("Business Promotions")
                ? supabase.from("promotion_custom_requests").select("id, business_id, status, phone, goal, area, pincode, coverage").order("created_at", { ascending: false }).limit(200)
                : Promise.resolve({ data: [] as Row[] }),
            ]);
            for (const row of ordersRes.data || []) {
              const snap = row.package_snapshot && typeof row.package_snapshot === "object"
                ? (row.package_snapshot as Record<string, unknown>)
                : {};
              const business = nameOf(String(row.business_id || ""));
              const packageName = String(snap.name || row.package_id || "");
              if (allowed.has("Business Promotions")) {
                docs.push(
                  makeSearchDoc({
                    key: `promo-order:${row.id}`,
                    kind: "Promotion order",
                    focusKind: "promotion-order",
                    tab: "Business Promotions",
                    title: business || packageName || "Promotion order",
                    subtitle: [packageName, String(row.payment_status || ""), String(row.campaign_status || ""), String(row.target_area || "")].filter(Boolean).join(" · "),
                    targetId: String(row.id),
                    extra: [business, packageName, String(row.target_pincode || ""), String(row.razorpay_payment_id || ""), String(row.amount_inr || "")],
                  }),
                );
              }
              const review = String(row.ad_review_status || "");
              const hasVideo = Boolean(row.video_public_id || row.video_url);
              if (allowed.has("Ads Request") && (review === "pending" || review === "approved" || review === "denied" || hasVideo)) {
                docs.push(
                  makeSearchDoc({
                    key: `ad:${row.id}`,
                    kind: "Ad request",
                    focusKind: "ad",
                    tab: "Ads Request",
                    title: business || packageName || "Ad request",
                    subtitle: [packageName, review || "pending", String(row.target_area || "")].filter(Boolean).join(" · "),
                    targetId: String(row.id),
                    extra: [business, packageName, String(snap.audience || ""), String(snap.content || ""), String(row.target_pincode || ""), String(row.payment_status || "")],
                  }),
                );
              }
            }
            for (const row of verifyRes.data || []) {
              const business = nameOf(String(row.business_id || ""));
              docs.push(
                makeSearchDoc({
                  key: `verify:${row.id}`,
                  kind: "Verification",
                  focusKind: "promotion-verification",
                  tab: "Business Promotions",
                  title: business || "Shop check",
                  subtitle: String(row.status || "Verification"),
                  targetId: String(row.id),
                  extra: [business, String(row.rejection_reason || ""), String(row.status || "")],
                }),
              );
            }
            for (const row of packageRes.data || []) {
              docs.push(
                makeSearchDoc({
                  key: `package:${row.id}`,
                  kind: "Ad package",
                  focusKind: "promotion-package",
                  tab: "Business Promotions",
                  title: String(row.name || "Package"),
                  subtitle: [row.coverage_label, row.price_inr != null ? `₹${row.price_inr}` : ""].filter(Boolean).join(" · "),
                  targetId: String(row.id),
                  extra: [String(row.coverage_label || ""), String(row.price_inr || ""), row.active ? "active" : "hidden"],
                }),
              );
            }
            for (const row of customRes.data || []) {
              const business = nameOf(String(row.business_id || ""));
              docs.push(
                makeSearchDoc({
                  key: `custom-promo:${row.id}`,
                  kind: "Custom promotion",
                  focusKind: "promotion-custom",
                  tab: "Business Promotions",
                  title: business || "Custom promotion",
                  subtitle: [String(row.goal || ""), String(row.status || "")].filter(Boolean).join(" · "),
                  targetId: String(row.id),
                  extra: [business, String(row.phone || ""), String(row.area || ""), String(row.pincode || ""), String(row.coverage || "")],
                }),
              );
            }
          })(),
        );
      }

      if (allowed.has("Broadcast Email")) {
        tasks.push(
          (async () => {
            const supabase = createClient();
            const { data } = await supabase
              .from("admin_outbound_emails")
              .select("id, subject, to_emails, cc_emails")
              .order("created_at", { ascending: false })
              .limit(80);
            for (const row of data || []) {
              const to = Array.isArray(row.to_emails) ? row.to_emails.map((item) => String(item)) : [];
              const cc = Array.isArray(row.cc_emails) ? row.cc_emails.map((item) => String(item)) : [];
              docs.push(
                makeSearchDoc({
                  key: `email:${row.id}`,
                  kind: "Email",
                  focusKind: "tab",
                  tab: "Broadcast Email",
                  title: String(row.subject || "Email"),
                  subtitle: to.slice(0, 2).join(", "),
                  extra: [...to, ...cc],
                }),
              );
            }
          })(),
        );
      }

      if (allowed.has("Manage Admins")) {
        tasks.push(
          (async () => {
            const supabase = createClient();
            const { data } = await supabase.from("admins").select("id, email, role, display_name").limit(100);
            for (const row of data || []) {
              docs.push(
                makeSearchDoc({
                  key: `admin:${row.id}`,
                  kind: "Admin",
                  focusKind: "admin",
                  tab: "Manage Admins",
                  title: String(row.display_name || row.email || "Admin"),
                  subtitle: [row.email, String(row.role || "").replace(/_/g, " ")].filter(Boolean).join(" · "),
                  targetId: String(row.id),
                  extra: [row.email, row.display_name, row.role],
                }),
              );
            }
          })(),
        );
      }

      if (allowed.has("Site Configurations")) {
        tasks.push(
          (async () => {
            const supabase = createClient();
            const { data } = await supabase.from("site_config").select("config").eq("id", "finderb").maybeSingle();
            const config = data?.config && typeof data.config === "object" ? (data.config as Record<string, Record<string, unknown>>) : {};
            const pricing = config.pricing || {};
            const contact = config.contact || {};
            const add = (key: string, title: string, subtitle: string, section: string, extra: Array<string | null | undefined>) => {
              docs.push(
                makeSearchDoc({
                  key: `site-value:${key}`,
                  kind: "Site config",
                  focusKind: "site-config",
                  tab: "Site Configurations",
                  title,
                  subtitle,
                  targetId: section,
                  extra,
                }),
              );
            };
            if (pricing.growthMonthly) add("growth", `Growth monthly ₹${pricing.growthMonthly}`, "Plan price", "Plans", ["growth", "monthly", String(pricing.growthMonthlyRetail || "")]);
            if (pricing.proAnnual) add("pro", `Pro annual ₹${pricing.proAnnual}`, "Plan price", "Plans", ["pro", "annual", String(pricing.proAnnualRetail || "")]);
            if (contact.email) add("email", String(contact.email), "Public email", "Contact", [String(contact.companyName || ""), String(contact.brand || "")]);
            if (contact.phone || contact.phoneDisplay) add("phone", String(contact.phoneDisplay || contact.phone), "Public phone", "Contact", [String(contact.phone || "")]);
            if (contact.companyName) add("company", String(contact.companyName), "Company", "Contact", [String(contact.addressLine1 || ""), String(contact.addressLine2 || ""), String(contact.pincode || "")]);
            if (contact.grievanceEmail) add("grievance", String(contact.grievanceEmail), "Grievance email", "Contact", [String(contact.grievanceName || "")]);
          })(),
        );
      }

      await Promise.all(tasks.map((task) => task.catch(() => undefined)));
      if (!cancelled) {
        setRemoteDocs(docs);
        setRemoteReady(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, adminId, remoteReady, tabKey]);

  useEffect(() => {
    if (!open || !adminId || !tabsRef.current.includes("Reviews")) {
      setReviewDocs([]);
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setReviewDocs([]);
      return;
    }
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams({
        adminId,
        kind: "all",
        q,
      });
      void fetch(`/api/admin/reviews?${params.toString()}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((json: { success?: boolean; rows?: Row[] }) => {
          if (!json?.success || !Array.isArray(json.rows)) {
            setReviewDocs([]);
            return;
          }
          setReviewDocs(
            json.rows.slice(0, 40).map((row) =>
              makeSearchDoc({
                key: `review:${text(row, "review_id") || text(row, "id")}`,
                kind: "Review",
                focusKind: "review",
                tab: "Reviews",
                title: text(row, "public_name") || text(row, "author_name") || "Review",
                subtitle: [text(row, "business_name"), clipText(text(row, "content"), 80)].filter(Boolean).join(" · "),
                targetId: text(row, "review_id") || text(row, "id"),
                extra: [text(row, "content"), text(row, "business_name"), text(row, "city"), text(row, "author_name")],
              }),
            ),
          );
        })
        .catch(() => setReviewDocs([]));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [open, adminId, query, tabKey]);

  const hits = useMemo(
    () => searchDocs([...localDocs, ...remoteDocs, ...reviewDocs], query, 14),
    [localDocs, remoteDocs, reviewDocs, query],
  );

  const searchMood: MomoMood = !query.trim()
    ? "wave"
    : reacting
      ? "curious"
      : hits.length > 0
        ? "happy"
        : remoteReady
          ? "sad"
          : "curious";

  useEffect(() => {
    if (!query.trim()) {
      setReacting(false);
      return;
    }
    setReacting(true);
    const timer = window.setTimeout(() => setReacting(false), 700);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (open) {
      setIdle("look");
      return;
    }
    const launch = document.querySelector(".admin-universal-search-launch");
    if (!launch || !launch.matches(":hover")) momoHover.current = false;
    const play: { mood: MomoMood; ms: number }[] = [
      { mood: "look", ms: 4200 },
      { mood: "peek", ms: 4200 },
      { mood: "wave", ms: 2000 },
      { mood: "dash", ms: 2100 },
      { mood: "walk", ms: 3800 },
      { mood: "look", ms: 6500 },
      { mood: "workout", ms: 2600 },
      { mood: "happy", ms: 2000 },
      { mood: "look", ms: 5200 },
    ];
    let step = 0;
    let settled = false;
    let ticker = 0;
    const advance = () => {
      if (settled) return;
      if (!momoHover.current) setIdle(play[step].mood);
      const wait = play[step].ms;
      step = (step + 1) % play.length;
      ticker = window.setTimeout(advance, wait);
    };
    setIdle("look");
    ticker = window.setTimeout(advance, play[0].ms);
    step = 1;
    const yawnAt = window.setTimeout(() => {
      settled = true;
      if (!momoHover.current) setIdle("yawn");
    }, 72_000);
    const sleepAt = window.setTimeout(() => {
      if (!momoHover.current) setIdle("sleep");
    }, 80_000);
    return () => {
      window.clearTimeout(ticker);
      window.clearTimeout(yawnAt);
      window.clearTimeout(sleepAt);
    };
  }, [open, idleEpoch]);

  useEffect(() => {
    setActive(0);
  }, [query, hits.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuery("");
        setOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = fieldRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const offsetLeft = viewport?.offsetLeft ?? 0;
      const width = viewportWidth >= 768
        ? Math.min(query.trim() ? 760 : 540, viewportWidth - 24)
        : viewportWidth - 24;
      const left = Math.min(Math.max(offsetLeft + 12, rect.right - width), offsetLeft + viewportWidth - width - 12);
      const top = rect.bottom + 8;
      setPopBox({
        top,
        left,
        width,
        maxHeight: Math.max(180, viewportHeight - top - 12),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open, query]);

  const choose = (hit: SearchHit) => {
    onOpen(hit);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="admin-universal-search" ref={rootRef}>
      {open ? (
        <div className="admin-universal-search-field" ref={fieldRef}>
          <Momo mood={searchMood} className="admin-momo-field" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                return;
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => Math.min(index + 1, Math.max(hits.length - 1, 0)));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter" && hits[active]) {
                event.preventDefault();
                choose(hits[active]);
              }
            }}
            placeholder="Momo Search"
            aria-label="Momo Search"
            aria-expanded
            aria-controls="admin-universal-search-list"
            role="combobox"
            autoComplete="off"
          />
          <button type="button" className="admin-universal-search-close" onClick={() => setOpen(false)} aria-label="Close search">
            Esc
          </button>
          {popBox
            ? createPortal(
                <div
                  ref={popRef}
                  className="admin-universal-search-pop admin-card"
                  id="admin-universal-search-list"
                  role="listbox"
                  style={{ top: popBox.top, left: popBox.left, width: popBox.width, maxHeight: popBox.maxHeight }}
                >
                  {query.trim() ? (
                    <>
                      <div className="admin-momo-live">
                        <Momo mood={searchMood} />
                        <span>
                          {searchMood === "happy"
                            ? "Here they are."
                            : searchMood === "sad"
                              ? "Momo couldn't find that. Try a name, email, phone, or city."
                              : "Momo is looking…"}
                        </span>
                      </div>
                      {hits.map((hit, index) => (
                        <button
                          key={hit.key}
                          type="button"
                          role="option"
                          aria-selected={index === active}
                          className={`admin-universal-search-hit ${index === active ? "is-active" : ""}`}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => choose(hit)}
                        >
                          <span className="admin-universal-search-kind">{hit.kind}</span>
                          <span className="admin-universal-search-copy">
                            <span className="admin-universal-search-title">
                              <Highlight text={hit.title} query={query} />
                            </span>
                            {hit.subtitle ? (
                              <span className="admin-universal-search-sub">
                                <Highlight text={hit.subtitle} query={query} />
                              </span>
                            ) : null}
                          </span>
                          <span className="admin-universal-search-tab">{hit.tab}</span>
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="admin-momo-greet">
                      <div className="admin-momo-stage">
                        <span className="admin-momo-star admin-momo-star-a" aria-hidden />
                        <span className="admin-momo-star admin-momo-star-b" aria-hidden />
                        <span className="admin-momo-float-heart" aria-hidden />
                        <Momo mood="wave" />
                      </div>
                      <div>
                        <p className="admin-momo-hi">{momoHello()} A search bot from FinderB.</p>
                        <p className="admin-momo-ask">Who should I look for?</p>
                      </div>
                    </div>
                  )}
                </div>,
                document.body,
              )
            : null}
        </div>
      ) : (
        <button
          type="button"
          className="admin-btn-ghost admin-universal-search-launch"
          onMouseEnter={() => {
            momoHover.current = true;
            setIdle("look");
          }}
          onMouseLeave={() => {
            momoHover.current = false;
            setIdleEpoch((value) => value + 1);
          }}
          onClick={() => {
            setQuery("");
            setOpen(true);
          }}
          aria-label="Momo Search"
          title="Momo Search"
        >
          <span className="admin-momo-lane" aria-hidden>
            <span className={`admin-momo-face is-${idle}`}>
              <span className="admin-momo-zs">
                <i>z</i>
                <i>z</i>
                <i>z</i>
              </span>
              <Momo mood={idle} />
            </span>
          </span>
          <span className="admin-momo-launch-label">Momo Search</span>
          <svg className="admin-momo-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      )}
    </div>
  );
}
