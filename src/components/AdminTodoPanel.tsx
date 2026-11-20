"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { waitingLabel } from "../lib/waitingLabel";

const TODO_FILL_COUNT = 8;
const DASHBOARD_GROUP_LIMIT = 4;

const TODO_TONES: Record<string, { label: string }> = {
  "user-flag": { label: "Review" },
  "business-flag": { label: "Review" },
  change: { label: "Change" },
  ownership: { label: "Ownership" },
  "job-report": { label: "Job report" },
  engagement: { label: "Engage" },
  merchant: { label: "Listing" },
  job: { label: "Job" },
  blog: { label: "Draft" },
  "blog-cadence": { label: "Blog" },
  "ad-request": { label: "Ad" },
  more: { label: "More" },
  fallback: { label: "Queue" },
};

const GROUP_NOUN: Record<string, [string, string]> = {
  Merchants: ["listing approval", "listing approvals"],
  Reviews: ["review report", "review reports"],
  "Change Requests": ["change request", "change requests"],
  "Ownership Requests": ["ownership request", "ownership requests"],
  "Job Reports": ["job report", "job reports"],
  "FinderB Jobs": ["job approval", "job approvals"],
  Blogs: ["blog task", "blog tasks"],
  "Ads Request": ["ad request", "ad requests"],
  Broadcasts: ["broadcast task", "broadcast tasks"],
};

export type AdminTodoItem = {
  id: string;
  tab: string;
  title: string;
  detail: string;
  targetId: string | null;
  waitingSince: string | null;
  kind: string;
};

type LeavingTodo = AdminTodoItem & { leaving: boolean; tone: number };

function useLeavingTodos(items: AdminTodoItem[]) {
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const signature = items
    .map((item) => `${item.id}\u0000${item.title}\u0000${item.detail}`)
    .join("\n");
  const [rows, setRows] = useState<LeavingTodo[]>(() =>
    items.map((item, index) => ({ ...item, leaving: false, tone: index % TODO_FILL_COUNT })),
  );

  useEffect(() => {
    const next = itemsRef.current;
    setRows((prev) => {
      const nextById = new Map(next.map((item) => [item.id, item]));
      const seen = new Set(prev.map((row) => row.id));
      const updated = prev.map((row) => {
        const incoming = nextById.get(row.id);
        if (!incoming) return { ...row, leaving: true };
        return { ...incoming, leaving: false, tone: row.tone };
      });
      const added = next
        .filter((item) => !seen.has(item.id))
        .map((item, index) => ({
          ...item,
          leaving: false,
          tone: (updated.length + index) % TODO_FILL_COUNT,
        }));
      return [...updated, ...added];
    });
  }, [signature]);

  useEffect(() => {
    if (!rows.some((row) => row.leaving)) return;
    const timer = window.setTimeout(() => {
      setRows((prev) => prev.filter((row) => !row.leaving));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [rows]);

  return rows;
}

function groupNoun(tab: string, count: number) {
  const pair = GROUP_NOUN[tab] || [tab, tab];
  return count === 1 ? pair[0] : pair[1];
}

function todoTone(kind: string): number {
  if (kind === "user-flag" || kind === "business-flag") return 0;
  if (kind === "merchant") return 1;
  if (kind === "job" || kind === "job-report") return 2;
  if (kind === "ownership") return 3;
  if (kind === "blog" || kind === "blog-cadence") return 4;
  if (kind === "change" || kind === "ad-request") return 5;
  if (kind === "engagement") return 6;
  return 7;
}

function todoMark(kind: string): string {
  if (kind === "user-flag" || kind === "business-flag") return "🚩";
  if (kind === "merchant") return "🏪";
  if (kind === "job") return "💼";
  if (kind === "job-report") return "⚠️";
  if (kind === "ownership") return "🔑";
  if (kind === "blog" || kind === "blog-cadence") return "📝";
  if (kind === "change") return "✏️";
  if (kind === "engagement") return "📣";
  if (kind === "ad-request") return "📢";
  return "📌";
}

export default function AdminTodoPanel({
  todos,
  todosReady,
  layout,
  onOpenTodo,
  onOpenBoard,
}: {
  todos: AdminTodoItem[];
  todosReady: boolean;
  layout: "compact" | "board";
  onOpenTodo: (item: AdminTodoItem) => void;
  onOpenBoard?: () => void;
}) {
  const rows = useLeavingTodos(todos);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const groups = useMemo(() => {
    const built: { key: string; tab: string; items: LeavingTodo[] }[] = [];
    for (const row of rows) {
      if (row.leaving || row.kind === "more") continue;
      const key = row.tab;
      let group = built.find((entry) => entry.key === key);
      if (!group) {
        group = { key, tab: row.tab, items: [] };
        built.push(group);
      }
      group.items.push(row);
    }
    return built;
  }, [rows]);

  const visibleGroups = layout === "board" ? groups : groups.slice(0, DASHBOARD_GROUP_LIMIT);
  const hiddenGroups = groups.length - visibleGroups.length;
  const waitingCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section className="admin-card overflow-hidden">
      <div className="admin-card-header">
        <div>
          <h2 className="admin-card-title">{layout === "board" ? "To-do" : "To-do"}</h2>
          <p className="admin-card-description">
            {todosReady
              ? waitingCount
                ? `${waitingCount} waiting · grouped by type`
                : "Refreshes every 5 minutes"
              : "Checking what needs a review"}
          </p>
        </div>
        {layout === "compact" && onOpenBoard ? (
          <button type="button" className="admin-btn-secondary !text-xs" onClick={onOpenBoard}>
            Open to-do
          </button>
        ) : null}
      </div>
      {!todosReady ? (
        <p className="px-4 py-6 text-sm text-slate-500">Loading the queue…</p>
      ) : groups.length === 0 ? (
        <div className="todo-clear">
          <h3 className="todo-kudos">
            <span aria-hidden>🎉</span>
            Kudos
          </h3>
          <p>
            Nothing needs a decision right now. Listings, reviews, claims, and reports will show up here as soon as they arrive.
          </p>
        </div>
      ) : (
        <div className="todo-list">
          {visibleGroups.map((group) => {
            const oldest = group.items[0];
            const waited = waitingLabel(oldest?.waitingSince);
            const expanded = layout === "board" || openGroup === group.key;
            const preview = layout === "board" ? group.items : group.items.slice(0, 3);
            const tone = todoTone(oldest?.kind || "fallback");
            const mark = todoMark(oldest?.kind || "fallback");
            if (group.items.length === 1) {
              const item = group.items[0];
              const label = TODO_TONES[item.kind] || TODO_TONES.fallback;
              return (
                <button
                  key={group.key}
                  type="button"
                  className="todo-card"
                  data-tone={todoTone(item.kind)}
                  onClick={() => onOpenTodo(item)}
                >
                  <span className="todo-index" aria-hidden>{todoMark(item.kind)}</span>
                  <span className="todo-copy">
                    <span className="todo-title-row">
                      <span className="todo-title">{item.title}</span>
                      <span className="todo-chip">{label.label}</span>
                    </span>
                    <span className="todo-detail">
                      {item.detail}
                      {waitingLabel(item.waitingSince) ? ` · ${waitingLabel(item.waitingSince)}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="todo-chevron" />
                </button>
              );
            }
            return (
              <div key={group.key} className="todo-group">
                <button
                  type="button"
                  className="todo-card"
                  data-tone={tone}
                  onClick={() => {
                    if (layout === "board") return;
                    setOpenGroup((current) => (current === group.key ? null : group.key));
                  }}
                >
                  <span className="todo-index" aria-hidden>{mark}</span>
                  <span className="todo-copy">
                    <span className="todo-title-row">
                      <span className="todo-title">
                        {group.items.length} {groupNoun(group.tab, group.items.length)}
                      </span>
                      <span className="todo-chip">{group.tab}</span>
                    </span>
                    <span className="todo-detail">
                      Oldest: {oldest?.title || "Waiting"}
                      {waited ? ` · ${waited}` : ""}
                    </span>
                  </span>
                  {layout === "compact" ? <ChevronRight className="todo-chevron" /> : null}
                </button>
                {expanded ? (
                  <div className="todo-group-items">
                    {preview.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="todo-card todo-card-nested"
                        data-tone={todoTone(item.kind)}
                        onClick={() => onOpenTodo(item)}
                      >
                        <span className="todo-index" aria-hidden>{todoMark(item.kind)}</span>
                        <span className="todo-copy">
                          <span className="todo-title">{item.title}</span>
                          <span className="todo-detail">
                            {item.detail}
                            {waitingLabel(item.waitingSince) ? ` · ${waitingLabel(item.waitingSince)}` : ""}
                          </span>
                        </span>
                        <ChevronRight className="todo-chevron" />
                      </button>
                    ))}
                    {layout === "compact" && group.items.length > preview.length && onOpenBoard ? (
                      <button type="button" className="admin-link mx-3 mb-2" onClick={onOpenBoard}>
                        {group.items.length - preview.length} more in the to-do window
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          {hiddenGroups > 0 && onOpenBoard ? (
            <button type="button" className="admin-btn-secondary mt-1 w-full" onClick={onOpenBoard}>
              {hiddenGroups} more {hiddenGroups === 1 ? "group" : "groups"} in the to-do window
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
