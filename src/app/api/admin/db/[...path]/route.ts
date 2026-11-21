import { NextRequest, NextResponse } from "next/server";
import { readAdminSession } from "../../../../../lib/adminSessionToken";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The anon key has no table access, so the console's browser client reaches the
// Supabase REST API through here with the service key once the admin session checks out.
const REQUEST_HEADERS = ["accept", "content-type", "prefer", "range", "range-unit", "accept-profile", "content-profile"];
const RESPONSE_HEADERS = ["content-type", "content-range", "preference-applied", "location"];
const ACTIVE_CHECK_MS = 60_000;
const activeUntil = new Map<string, number>();

async function isActiveAdmin(url: string, key: string, adminId: string, epoch: number): Promise<boolean> {
  const cacheKey = `${adminId}:${epoch}`;
  if ((activeUntil.get(cacheKey) ?? 0) > Date.now()) return true;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const withEpoch = await fetch(
    `${url}/rest/v1/admins?select=id,is_disabled,session_epoch&id=eq.${encodeURIComponent(adminId)}`,
    { headers, cache: "no-store" },
  );
  if (!withEpoch.ok) {
    const plain = await fetch(
      `${url}/rest/v1/admins?select=id,is_disabled&id=eq.${encodeURIComponent(adminId)}`,
      { headers, cache: "no-store" },
    );
    const rows = plain.ok ? ((await plain.json()) as { is_disabled?: boolean | null }[]) : [];
    const active = Boolean(rows[0]) && !rows[0].is_disabled;
    if (active) activeUntil.set(cacheKey, Date.now() + ACTIVE_CHECK_MS);
    else activeUntil.delete(cacheKey);
    return active;
  }
  const rows = (await withEpoch.json()) as { is_disabled?: boolean | null; session_epoch?: number | null }[];
  const row = rows[0];
  const active = Boolean(row) && !row.is_disabled && Number(row.session_epoch || 0) === epoch;
  if (active) activeUntil.set(cacheKey, Date.now() + ACTIVE_CHECK_MS);
  else activeUntil.delete(cacheKey);
  return active;
}

async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return NextResponse.json({ message: "Database access is not configured on the server." }, { status: 500 });
  }

  const session = readAdminSession(request.headers.get("x-admin-session") || "");
  if (!session || !(await isActiveAdmin(url, key, session.adminId, session.epoch))) {
    return NextResponse.json(
      { message: "Admin session expired. Please sign in again.", code: "ADMIN_SESSION" },
      { status: 401 },
    );
  }

  const restPath = request.nextUrl.pathname.replace(/^\/api\/admin\/db\/?/, "");
  if (!restPath || restPath.includes("..")) {
    return NextResponse.json({ message: "Invalid path." }, { status: 400 });
  }
  if (restPath.split("/")[0].split("?")[0] === "admin_panel_pins") {
    return NextResponse.json({ message: "That table is not available here." }, { status: 403 });
  }

  const headers = new Headers({ apikey: key, Authorization: `Bearer ${key}` });
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const method = request.method.toUpperCase();
  const upstream = await fetch(`${url}/rest/v1/${restPath}${request.nextUrl.search}`, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  const noBody = method === "HEAD" || upstream.status === 204 || upstream.status === 304;
  return new NextResponse(noBody ? null : await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE, proxy as HEAD };
