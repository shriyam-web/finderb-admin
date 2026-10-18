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

type Row = Record<string, unknown>;

function text(row: object | null | undefined, key: string): string {
  if (!row) return "";
  const value = (row as Record<string, unknown>)[key];
  if (value == null) return "";
  return String(value);
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
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [popBox, setPopBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

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

    const pushMerchant = (merchant: object, pending: boolean) => {
      const id = text(merchant, "id");
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

    for (const category of categories) {
      const id = text(category, "id");
      docs.push(
        makeSearchDoc({
          key: `category:${id}`,
          kind: "Category",
          focusKind: "category",
          tab: "Categories",
          title: text(category, "name") || "Category",
          subtitle: text(category, "type") || text(category, "status"),
          targetId: id,
          extra: [text(category, "status"), text(category, "type"), id],
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
          title: text(admin, "email") || "Admin",
          subtitle: text(admin, "role").replace(/_/g, " "),
          targetId: id,
          extra: [text(admin, "role"), id],
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

  useEffect(() => {
    setActive(0);
  }, [query, hits.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
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
      const width = Math.min(448, window.innerWidth - 24);
      const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
      setPopBox({ top: rect.bottom + 8, left, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const choose = (hit: SearchHit) => {
    onOpen(hit);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="admin-universal-search" ref={rootRef}>
      {open ? (
        <div className="admin-universal-search-field" ref={fieldRef}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
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
            placeholder="Search the whole panel"
            aria-label="Search the admin panel"
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
                  style={{ top: popBox.top, left: popBox.left, width: popBox.width }}
                >
                  {query.trim() ? (
                    hits.length === 0 ? (
                      <p className="admin-universal-search-empty">
                        {remoteReady ? "No matches. Try a name, email, phone, city, or id." : "Searching records…"}
                      </p>
                    ) : (
                      hits.map((hit, index) => (
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
                      ))
                    )
                  ) : (
                    <p className="admin-universal-search-empty">
                      Find a user, merchant, lead, payment, review, job, blog, or menu. Ctrl K opens this from anywhere.
                    </p>
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
          onClick={() => setOpen(true)}
          aria-label="Open universal search"
          title="Search the admin panel"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      )}
    </div>
  );
}
