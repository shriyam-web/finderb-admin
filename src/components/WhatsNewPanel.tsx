"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../utils/supabase/client";
import { formatDateTimeInr } from "../lib/formatDateTime";
import {
  fetchWhatsNewEntries,
  markAllWhatsNewRead,
  markWhatsNewRead,
  type WhatsNewEntry,
} from "../lib/whatsNew";
import { useAdminToast } from "./AdminToast";
import AdminOverlay from "./AdminOverlay";

const WHATS_NEW_POS_KEY = "admin_whats_new_pos";

type FabPos = { x: number; y: number };

function readFabPos(): FabPos | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WHATS_NEW_POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FabPos;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function clampFab(x: number, y: number, width: number, height: number): FabPos {
  const pad = 8;
  return {
    x: Math.min(Math.max(pad, x), Math.max(pad, window.innerWidth - width - pad)),
    y: Math.min(Math.max(pad, y), Math.max(pad, window.innerHeight - height - pad)),
  };
}

type Props = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  adminId: string;
  unreadCount: number;
  onUnreadCountChange: (count: number) => void;
};

export default function WhatsNewPanel({
  open,
  onOpen,
  onClose,
  adminId,
  unreadCount,
  onUnreadCountChange,
}: Props) {
  const { toast } = useAdminToast();
  const supabase = useMemo(() => createClient(), []);

  const [entries, setEntries] = useState<WhatsNewEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [fabPos, setFabPos] = useState<FabPos | null>(null);
  const [draggingFab, setDraggingFab] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });

  useEffect(() => {
    setFabPos(readFabPos());
  }, []);

  const panelUnread = useMemo(
    () => entries.filter((entry) => !entry.isRead).length,
    [entries],
  );

  const load = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    setError(null);
    const result = await fetchWhatsNewEntries(supabase, adminId);
    if (result.error) {
      setError(
        result.error.includes("does not exist") ||
          result.error.includes("schema cache")
          ? "What's New tables are missing. Run db/create_admin_whats_new_tables.sql in Supabase."
          : result.error,
      );
      setEntries([]);
      onUnreadCountChange(0);
    } else {
      setEntries(result.entries);
      onUnreadCountChange(result.unreadCount);
    }
    setLoading(false);
  }, [adminId, onUnreadCountChange, supabase]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleMarkRead = async (itemId: string) => {
    setMarkingId(itemId);
    const { error: markError } = await markWhatsNewRead(
      supabase,
      adminId,
      itemId,
    );
    if (markError) {
      toast(markError, "error");
      setMarkingId(null);
      return;
    }
    setEntries((prev) => {
      const next = prev.map((entry) =>
        entry.id === itemId
          ? { ...entry, isRead: true, readAt: new Date().toISOString() }
          : entry,
      );
      onUnreadCountChange(next.filter((entry) => !entry.isRead).length);
      return next;
    });
    setMarkingId(null);
  };

  const handleMarkAll = async () => {
    const unreadIds = entries.filter((e) => !e.isRead).map((e) => e.id);
    if (!unreadIds.length) return;
    setMarkingAll(true);
    const { error: markError } = await markAllWhatsNewRead(
      supabase,
      adminId,
      unreadIds,
    );
    if (markError) {
      toast(markError, "error");
      setMarkingAll(false);
      return;
    }
    const now = new Date().toISOString();
    setEntries((prev) =>
      prev.map((entry) =>
        entry.isRead ? entry : { ...entry, isRead: true, readAt: now },
      ),
    );
    onUnreadCountChange(0);
    setMarkingAll(false);
    toast("All updates marked as read", "success");
  };

  const badgeCount = open ? panelUnread : unreadCount;

  return (
    <>
      {!open && (
        <button
          ref={fabRef}
          type="button"
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            dragRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              originX: rect.left,
              originY: rect.top,
              moved: false,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragRef.current.pointerId !== event.pointerId) return;
            const dx = event.clientX - dragRef.current.startX;
            const dy = event.clientY - dragRef.current.startY;
            if (Math.abs(dx) + Math.abs(dy) < 5) return;
            dragRef.current.moved = true;
            const rect = event.currentTarget.getBoundingClientRect();
            setDraggingFab(true);
            setFabPos(
              clampFab(
                dragRef.current.originX + dx,
                dragRef.current.originY + dy,
                rect.width,
                rect.height,
              ),
            );
          }}
          onPointerUp={(event) => {
            if (dragRef.current.pointerId !== event.pointerId) return;
            dragRef.current.pointerId = -1;
            setDraggingFab(false);
            if (!dragRef.current.moved || !fabRef.current) return;
            const rect = fabRef.current.getBoundingClientRect();
            const next = clampFab(rect.left, rect.top, rect.width, rect.height);
            setFabPos(next);
            localStorage.setItem(WHATS_NEW_POS_KEY, JSON.stringify(next));
          }}
          onClick={(event) => {
            if (dragRef.current.moved) {
              event.preventDefault();
              dragRef.current.moved = false;
              return;
            }
            onOpen();
          }}
          className={`admin-whats-new-fab ${fabPos ? "is-placed" : ""} ${draggingFab ? "is-dragging" : ""}`}
          style={fabPos ? { left: fabPos.x, top: fabPos.y } : undefined}
          title="Drag to move. Click to open."
          aria-label={
            badgeCount > 0
              ? `What's New, ${badgeCount} unread`
              : "What's New"
          }
        >
          <span className="admin-whats-new-fab-label">What&apos;s New</span>
          {badgeCount > 0 && (
            <span className="admin-whats-new-fab-badge">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
        </button>
      )}

      {open && (
        <AdminOverlay className="" role="dialog">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/25"
            aria-label="Close What's New"
            onClick={onClose}
          />
          <aside className="admin-whats-new-panel">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5">
              <div>
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                  What&apos;s New
                </h2>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Latest FinderB Admin enhancements
                  {panelUnread > 0 ? ` · ${panelUnread} unread` : ""}
                </p>
              </div>
              <button
                type="button"
                className="admin-btn-secondary !text-xs !py-1.5 !px-2.5"
                onClick={onClose}
              >
                Close
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <button
                type="button"
                className="admin-btn-secondary !text-xs"
                disabled={markingAll || panelUnread === 0}
                onClick={() => void handleMarkAll()}
              >
                {markingAll ? "Marking…" : "Mark all read"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
              {loading && (
                <p className="text-[13px] text-slate-500 px-1 py-6 text-center">
                  Loading updates…
                </p>
              )}
              {!loading && error && (
                <div className="admin-alert-error text-[12px]">{error}</div>
              )}
              {!loading && !error && entries.length === 0 && (
                <p className="text-[13px] text-slate-500 px-1 py-6 text-center">
                  No updates yet.
                </p>
              )}
              {!loading &&
                !error &&
                entries.map((entry) => (
                  <article
                    key={entry.id}
                    className={`rounded-lg border px-3.5 py-3 ${
                      entry.isRead
                        ? "border-slate-200 bg-white"
                        : "border-teal-200 bg-teal-50/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!entry.isRead && (
                        <span className="admin-nav-badge-new !ml-0">New</span>
                      )}
                      <time
                        className="text-[11px] font-medium text-slate-500 tabular-nums"
                        dateTime={entry.published_at}
                      >
                        {formatDateTimeInr(entry.published_at)}
                      </time>
                    </div>
                    <h3 className="mt-1.5 text-[14px] font-semibold text-slate-900 leading-snug">
                      {entry.title}
                    </h3>
                    <p className="mt-1.5 text-[12.5px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {entry.body}
                    </p>
                    <div className="mt-2.5 flex items-center justify-end">
                      {entry.isRead ? (
                        <span className="text-[11px] text-slate-400">Read</span>
                      ) : (
                        <button
                          type="button"
                          className="admin-btn-secondary !text-[11px] !py-1 !px-2.5"
                          disabled={markingId === entry.id}
                          onClick={() => void handleMarkRead(entry.id)}
                        >
                          {markingId === entry.id ? "Saving…" : "Mark as read"}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          </aside>
        </AdminOverlay>
      )}
    </>
  );
}

/** Lightweight unread badge loader while the floating panel is closed. */
export function useWhatsNewUnreadCount(adminId: string | null | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!adminId) {
      setUnreadCount(0);
      return;
    }
    const result = await fetchWhatsNewEntries(supabase, adminId);
    if (!result.error) setUnreadCount(result.unreadCount);
  }, [adminId, supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { unreadCount, setUnreadCount, refreshUnread: refresh };
}
