"use client";

import { useEffect, useRef, useState } from "react";
import AdminAccessReportButton from "./AdminAccessReportButton";
import type { AccessReportTab } from "../lib/adminAccessReport";
import type { AdminAccessSession } from "../lib/adminTabAccess";

type AdminAccountMenuProps = {
  name: string;
  email?: string | null;
  role: string;
  avatarUrl?: string | null;
  session: AdminAccessSession & { email?: string | null };
  tabs: AccessReportTab[];
  onSettings: () => void;
  onSignOut: () => void;
};

function roleLabel(role: string): string {
  if (role === "developer") return "Developer";
  if (role === "controller") return "Controller";
  if (role === "super_admin") return "Super admin";
  return role.replace(/_/g, " ") || "Admin";
}

function roleClass(role: string): string {
  if (role === "developer") return "admin-role-badge admin-role-badge-developer normal-case";
  if (role === "controller") return "admin-role-badge admin-role-badge-controller";
  if (role === "super_admin") return "admin-role-badge admin-role-badge-super";
  return "admin-role-badge admin-role-badge-admin";
}

function AccountPhoto({
  avatarUrl,
  initial,
  large,
}: {
  avatarUrl?: string | null;
  initial: string;
  large?: boolean;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={large ? "admin-account-photo admin-account-photo-large" : "admin-account-photo"}
      />
    );
  }
  return (
    <span className={large ? "admin-avatar-dark admin-account-popover-avatar" : "admin-avatar-dark"}>
      {initial}
    </span>
  );
}

export default function AdminAccountMenu({
  name,
  email,
  role,
  avatarUrl,
  session,
  tabs,
  onSettings,
  onSignOut,
}: AdminAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const initial = (name.trim() || "A").charAt(0).toUpperCase();

  const cancelClose = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };

  useEffect(() => () => cancelClose(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="admin-account-menu"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className="admin-account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
      >
        <AccountPhoto avatarUrl={avatarUrl} initial={initial} />
      </button>
      <AdminAccessReportButton
        session={{ ...session, email: email || session.email }}
        tabs={tabs}
        trigger={(openReport) =>
          open ? (
            <div className="admin-account-popover">
              <div className="admin-account-popover-card" role="menu">
                <div className="admin-account-popover-head">
                  <AccountPhoto avatarUrl={avatarUrl} initial={initial} large />
                  <div className="min-w-0">
                    <p className="admin-account-popover-name">{name}</p>
                    {email ? <p className="admin-account-popover-email">{email}</p> : null}
                    <span className={roleClass(role)}>{roleLabel(role)}</span>
                  </div>
                </div>
                <div className="admin-account-menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  className="admin-account-action"
                  onClick={() => {
                    setOpen(false);
                    openReport();
                  }}
                >
                  Copy tab and permissions
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="admin-account-action"
                  onClick={() => {
                    setOpen(false);
                    onSettings();
                  }}
                >
                  Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="admin-account-action admin-account-action-danger"
                  onClick={() => {
                    setOpen(false);
                    onSignOut();
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
}
