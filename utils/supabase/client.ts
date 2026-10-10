import { createBrowserClient } from "@supabase/ssr";

function adminSessionToken(): string {
  try {
    const raw = localStorage.getItem("admin_session");
    return raw ? String((JSON.parse(raw) as { token?: string }).token || "") : "";
  } catch {
    return "";
  }
}

export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  // The anon key cannot read or write tables, so table requests go through the
  // signed-in admin proxy at /api/admin/db.
  const restPrefix = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/`;
  const adminFetch: typeof fetch = (input, init) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!href.startsWith(restPrefix)) return fetch(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.delete("apikey");
    headers.delete("authorization");
    headers.set("x-admin-session", adminSessionToken());
    return fetch(`/api/admin/db/${href.slice(restPrefix.length)}`, { ...init, headers });
  };

  return createBrowserClient(supabaseUrl, supabaseKey, {
    global: { fetch: adminFetch },
  });
};
