"use client";

import { LoaderCircle } from "lucide-react";

export default function AdminContentLoader({
  label = "Loading this view",
}: {
  label?: string;
}) {
  return (
    <div
      className="admin-card flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <LoaderCircle className="h-8 w-8 animate-spin text-orange-600" aria-hidden />
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <p className="max-w-sm text-xs text-slate-500">
        Data for this view is still loading.
      </p>
    </div>
  );
}
