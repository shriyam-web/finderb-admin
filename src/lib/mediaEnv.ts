import { createClient } from "@supabase/supabase-js";
import { parseMediaProvider } from "./siteConfigAdmin";

export const ADMIN_MEDIA_AREAS = [
  "Merchants",
  "Categories",
  "Blogs",
  "Movies",
  "News",
  "Tourist Places",
] as const;

export type AdminMediaArea = (typeof ADMIN_MEDIA_AREAS)[number];

export function isAdminMediaArea(value: unknown): value is AdminMediaArea {
  return ADMIN_MEDIA_AREAS.includes(value as AdminMediaArea);
}

export type PublicS3Env = {
  ready: boolean;
  region: string;
  publicBucket: string;
  cdnHost: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function cleanHost(value: string) {
  return value.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
}

export function publicS3Env(): PublicS3Env {
  const region = process.env.AWS_REGION?.trim() || "";
  const publicBucket = process.env.FINDERB_S3_PUBLIC_BUCKET?.trim() || "";
  const privateBucket = process.env.FINDERB_S3_PRIVATE_BUCKET?.trim() || "";
  const cdnHost = cleanHost(process.env.FINDERB_MEDIA_CDN_HOST || "");
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim() || "";
  const ready = Boolean(
    region && publicBucket && privateBucket && publicBucket !== privateBucket && cdnHost && accessKeyId && secretAccessKey,
  );
  return { ready, region, publicBucket, cdnHost, accessKeyId, secretAccessKey };
}

export async function loadEnabledAdmin(adminId: string) {
  const supabase = serviceClient();
  if (!supabase || !adminId) return null;
  const { data, error } = await supabase
    .from("admins")
    .select("id, role, is_disabled, allowed_tabs, allowed_tab_modes")
    .eq("id", adminId)
    .maybeSingle();
  if (error || !data || data.is_disabled) return null;
  return data;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Amazon S3 is active only when the saved choice is S3 and storage settings exist. */
export async function amazonImageStorageActive(): Promise<boolean> {
  if (!publicS3Env().ready) return false;
  const supabase = serviceClient();
  if (!supabase) return false;
  const { data } = await supabase.from("site_config").select("config").eq("id", "finderb").maybeSingle();
  const config = (data as { config?: unknown } | null)?.config;
  const media = config && typeof config === "object" ? (config as { media?: { provider?: unknown } }).media : null;
  return parseMediaProvider(media?.provider) === "s3";
}
