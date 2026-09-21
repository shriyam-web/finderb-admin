"use client";

import { useMemo, useState } from "react";
import { useAdminToast } from "./AdminToast";

type AdminSession = {
  id: string;
  email?: string;
  role?: string;
};

type MerchantHit = {
  id: string;
  businessName: string;
  displayName: string;
  registrationNumber: string | null;
  slug: string | null;
  city: string | null;
  status: string | null;
  email: string | null;
  mobile: string | null;
};

type Props = {
  adminSession: AdminSession | null;
  canManage: boolean;
};

export default function MerchantSupportLoginContent({
  adminSession,
  canManage,
}: Props) {
  const { toast } = useAdminToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MerchantHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<MerchantHit | null>(null);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [opening, setOpening] = useState(false);
  const [lastRedeemUrl, setLastRedeemUrl] = useState("");

  const canOpen = useMemo(
    () => Boolean(canManage && selected && password.trim() && adminSession?.id),
    [canManage, selected, password, adminSession?.id],
  );

  const handleSearch = async () => {
    if (!adminSession?.id) return;
    if (query.trim().length < 2) {
      toast("Enter at least 2 characters.", "error");
      return;
    }
    setSearching(true);
    setSelected(null);
    try {
      const res = await fetch(
        `/api/admin/support-login?adminId=${encodeURIComponent(adminSession.id)}&q=${encodeURIComponent(query.trim())}`,
      );
      const json = await res.json();
      if (!json?.success) {
        toast(json?.error || "Search failed.", "error");
        setResults([]);
        return;
      }
      setResults(Array.isArray(json.businesses) ? json.businesses : []);
      if (!json.businesses?.length) toast("No merchants found.", "info");
    } catch {
      toast("Search failed.", "error");
    } finally {
      setSearching(false);
    }
  };

  const handleOpen = async () => {
    if (!canOpen || !selected || !adminSession?.id) return;
    setOpening(true);
    setLastRedeemUrl("");
    try {
      const res = await fetch("/api/admin/support-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: adminSession.id,
          password,
          businessId: selected.id,
          reason,
        }),
      });
      const json = await res.json();
      if (!json?.success || !json?.redeemUrl) {
        toast(json?.error || "Could not open support session.", "error");
        return;
      }
      setPassword("");
      setLastRedeemUrl(String(json.redeemUrl));
      const popup = window.open(String(json.redeemUrl), "_blank");
      if (!popup) {
        toast(
          "Popup blocked — use the link below (or allow popups for Admin).",
          "error",
        );
        return;
      }
      toast(
        `Opened ${selected.displayName || selected.businessName}. Session ends after 15 minutes of inactivity.`,
        "success",
      );
    } catch {
      toast("Could not open support session.", "error");
    } finally {
      setOpening(false);
    }
  };

  if (!canManage) {
    return (
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Merchant Support Login
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          You need edit access to this tab. Ask a Developer to grant it in Manage
          Admins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Merchant Support Login
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Search a merchant by name, Merchant ID, registration number, email, or
          slug. Re-enter your admin password to open their FinderB merchant panel
          for <strong>15 minutes of inactivity</strong>. Every open is logged.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSearch();
            }}
            placeholder="Business name, Merchant ID, FINDERB-XXXX…"
            className="admin-input flex-1"
          />
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={searching}
            onClick={() => void handleSearch()}
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800">
          Results ({results.length})
        </div>
        <div className="divide-y divide-slate-100">
          {results.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">
              Search to list merchants.
            </p>
          ) : (
            results.map((row) => {
              const active = selected?.id === row.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelected(row)}
                  className={`flex w-full flex-col gap-1 px-5 py-4 text-left transition ${
                    active ? "bg-teal-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {row.displayName || row.businessName}
                    </span>
                    {row.status ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        {row.status}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">
                    {row.registrationNumber || "No Merchant ID"} · {row.city || "—"} ·{" "}
                    {row.email || "no email"}
                  </p>
                  <p className="font-mono text-[11px] text-slate-400">{row.id}</p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {selected ? (
        <div className="admin-card space-y-4 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Selected merchant
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {selected.displayName || selected.businessName}
            </p>
            <p className="text-sm text-slate-500">
              {selected.registrationNumber || selected.id}
            </p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Reason (optional)
            </span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="admin-input w-full"
              placeholder="e.g. Help merchant fix photos"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Confirm your admin password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-input w-full"
              placeholder="Admin password"
              autoComplete="current-password"
            />
          </label>

          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={!canOpen || opening}
            onClick={() => void handleOpen()}
          >
            {opening ? "Opening…" : "Open merchant panel (15 min idle)"}
          </button>

          {lastRedeemUrl ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Support link (opens for ~2 minutes, one-time use)
              </p>
              <a
                href={lastRedeemUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-sm font-medium text-teal-700 underline"
              >
                {lastRedeemUrl}
              </a>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => {
                    void navigator.clipboard.writeText(lastRedeemUrl);
                    toast("Link copied.", "success");
                  }}
                >
                  Copy link
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => {
                    window.location.assign(lastRedeemUrl);
                  }}
                >
                  Open in this tab
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
