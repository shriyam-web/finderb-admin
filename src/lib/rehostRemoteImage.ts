/**
 * Server-side image rehost helpers for GMB / Place Photo URLs.
 * Cloudinary's remote-fetch often fails on Google redirect URLs, so we
 * download bytes ourselves (follow redirects) then upload as a data URI.
 */

function cloudinaryConfig() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloudName || !uploadPreset) return null;
  return { cloudName, uploadPreset };
}

function isGoogleMapsPhotoUrl(url: string): boolean {
  return (
    url.includes("maps.googleapis.com/maps/api/place/photo") ||
    url.includes("maps.googleapis.com/maps/api/place/Photo") ||
    url.includes("lh3.googleusercontent.com") ||
    url.includes("streetviewpixels-pa.googleapis.com")
  );
}

export async function fetchRemoteImageBytes(
  imageUrl: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!imageUrl.trim()) return null;

  try {
    const res = await fetch(imageUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "FinderBAdmin/1.0 (place-photo-rehost)",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html") || contentType.includes("application/json")) {
      return null;
    }

    const ab = await res.arrayBuffer();
    if (!ab.byteLength || ab.byteLength < 64) return null;

    return {
      bytes: Buffer.from(ab),
      contentType: contentType.startsWith("image/")
        ? contentType.split(";")[0]!.trim()
        : "image/jpeg",
    };
  } catch {
    return null;
  }
}

export async function uploadBytesToCloudinary(
  bytes: Buffer,
  contentType: string,
): Promise<string | null> {
  const cfg = cloudinaryConfig();
  if (!cfg) return null;

  const dataUri = `data:${contentType};base64,${bytes.toString("base64")}`;

  try {
    const form = new FormData();
    form.append("file", dataUri);
    form.append("upload_preset", cfg.uploadPreset);
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`,
      {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(45000),
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { secure_url?: string };
    return json.secure_url || null;
  } catch {
    return null;
  }
}

/** Download a remote image and upload to Cloudinary. Returns CDN URL or null. */
export async function rehostRemoteImageUrl(
  imageUrl: string,
): Promise<string | null> {
  const fetched = await fetchRemoteImageBytes(imageUrl);
  if (!fetched) {
    // Fallback: let Cloudinary pull the URL itself (works for some CDNs).
    const cfg = cloudinaryConfig();
    if (!cfg) return null;
    try {
      const form = new FormData();
      form.append("file", imageUrl);
      form.append("upload_preset", cfg.uploadPreset);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`,
        {
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { secure_url?: string };
      return json.secure_url || null;
    } catch {
      return null;
    }
  }

  return uploadBytesToCloudinary(fetched.bytes, fetched.contentType);
}

/**
 * Rehost up to `limit` gallery URLs. Google Place Photo URLs are always
 * downloaded first; other https URLs are kept if rehost fails.
 */
export async function resolveGalleryImages(
  photoUrls: string[],
  limit = 5,
): Promise<string[]> {
  const out: string[] = [];
  for (const url of photoUrls.slice(0, limit)) {
    if (!url?.trim()) continue;
    const hosted = await rehostRemoteImageUrl(url.trim());
    if (hosted) {
      out.push(hosted);
      continue;
    }
    // Keep durable non-Google https URLs if rehost fails
    if (url.startsWith("https://") && !isGoogleMapsPhotoUrl(url)) {
      out.push(url);
    }
  }
  return out;
}
