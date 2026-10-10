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

async function isActiveAdmin(url: string, key: string, adminId: string): Promise<boolean> {
  if ((activeUntil.get(adminId) ?? 0) > Date.now()) return true;
  const res = await fetch(
    `${url}/rest/v1/admins?select=id,is_disabled&id=eq.${encodeURIComponent(adminId)}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
  );
  const rows = res.ok ? ((await res.json()) as { is_disabled?: boolean | null }[]) : [];
  const active = Boolean(rows[0]) && !rows[0].is_disabled;
  if (active) activeUntil.set(adminId, Date.now() + ACTIVE_CHECK_MS);
  else activeUntil.delete(adminId);
  return active;
}

async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return NextResponse.json({ message: "Database access is not configured on the server." }, { status: 500 });
  }

  const session = readAdminSession(request.headers.get("x-admin-session") || "");
  if (!session || !(await isActiveAdmin(url, key, session.adminId))) {
    return NextResponse.json(
      { message: "Admin session expired. Please sign in again.", code: "ADMIN_SESSION" },
      { status: 401 },
    );
  }

  const restPath = request.nextUrl.pathname.replace(/^\/api\/admin\/db\/?/, "");
  if (!restPath || restPath.includes("..")) {
    return NextResponse.json({ message: "Invalid path." }, { status: 400 });
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
