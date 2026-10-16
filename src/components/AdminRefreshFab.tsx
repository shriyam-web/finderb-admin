"use client";

import { useEffect, useRef, useState } from "react";

import { REFRESH_FAB_POS_KEY, readFabPosition, writeFabPosition, type FabPos } from "../lib/adminFabPosition";

function clamp(x: number, y: number, width: number, height: number): FabPos {
  const maxX = Math.max(8, window.innerWidth - width - 8);
  const maxY = Math.max(8, window.innerHeight - height - 8);
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  };
}

export default function AdminRefreshFab({
  busy,
  onRefresh,
}: {
  busy: boolean;
  onRefresh: () => void;
}) {
  const [pos, setPos] = useState<FabPos | null>(null);
  const [dragging, setDragging] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });

  useEffect(() => {
    setPos(readFabPosition(REFRESH_FAB_POS_KEY));
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={busy}
      className={`admin-refresh-fab ${pos ? "is-placed" : ""} ${dragging ? "is-dragging" : ""} ${busy ? "is-busy" : ""}`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      title="Drag to move. Click to refresh this tab."
      aria-label={busy ? "Refreshing" : "Refresh this tab"}
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
        setDragging(true);
        setPos(
          clamp(
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
        setDragging(false);
        if (!dragRef.current.moved || !buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const next = clamp(rect.left, rect.top, rect.width, rect.height);
        setPos(next);
        writeFabPosition(REFRESH_FAB_POS_KEY, next);
      }}
      onClick={(event) => {
        if (dragRef.current.moved) {
          event.preventDefault();
          dragRef.current.moved = false;
          return;
        }
        onRefresh();
      }}
    >
      <svg
        className={`admin-refresh-fab-icon ${busy ? "is-spin" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M4 4v6h6M20 20v-6h-6"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M20 9a8 8 0 00-14.9-3M4 15a8 8 0 0014.9 3"
        />
      </svg>
      <span>{busy ? "Refreshing" : "Refresh"}</span>
    </button>
  );
}
