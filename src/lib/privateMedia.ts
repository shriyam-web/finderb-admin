import crypto from "crypto";

export type PrivateResource = "image" | "video" | "raw";

export type StoredAsset = {
  publicId: string;
  resource: PrivateResource;
  format: string;
};

function creds() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || "";
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() || "";
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function privateMediaConfigured() {
  return Boolean(creds());
}

function signCloudinaryParams(params: Record<string, string>, apiSecret: string) {
  const toSign = Object.keys(params)
    .filter((key) => params[key])
    .sort()
    .map((key) => `${key}=${params[key]}`.replace(/&/g, "%26"))
    .join("&");
  return crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");
}

export function privateDownloadUrl(asset: StoredAsset, attachment = false): string | null {
  const auth = creds();
  if (!auth || !asset.publicId) return null;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const expiresAt = String(Math.floor(Date.now() / 1000) + 10 * 60);
  const params: Record<string, string> = {
    expires_at: expiresAt,
    public_id: asset.publicId,
    timestamp,
    type: "authenticated",
  };
  if (asset.format) params.format = asset.format;
  if (attachment) params.attachment = "true";
  const signature = signCloudinaryParams(params, auth.apiSecret);
  const query = new URLSearchParams({ ...params, api_key: auth.apiKey, signature });
  return `https://api.cloudinary.com/v1_1/${auth.cloudName}/${asset.resource}/download?${query}`;
}

export function readStoredAssets(value: unknown): StoredAsset[] {
  if (!Array.isArray(value)) return [];
  const assets: StoredAsset[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const resource = row.resource;
    const publicId = String(row.publicId || "");
    if (!publicId || (resource !== "image" && resource !== "video" && resource !== "raw")) continue;
    assets.push({ publicId, resource, format: String(row.format || "") });
  }
  return assets;
}
