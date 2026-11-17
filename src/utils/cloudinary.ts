import type { AdminMediaArea } from "../lib/mediaEnv";

function readAdminId() {
  try {
    const raw = localStorage.getItem("admin_session");
    const session = raw ? (JSON.parse(raw) as { id?: unknown }) : null;
    return typeof session?.id === "string" ? session.id : "";
  } catch {
    return "";
  }
}

function putWithProgress(url: string, file: File, contentType: string, onProgress?: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("Upload failed"));
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(file);
  });
}

async function uploadToS3(file: File, adminId: string, area: AdminMediaArea, onProgress?: (progress: number) => void) {
  const presign = await fetch("/api/admin/media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminId, area, bytes: file.size }),
  });
  const ticket = (await presign.json().catch(() => null)) as {
    uploadUrl?: string;
    contentType?: string;
    key?: string;
    error?: string;
  } | null;
  if (!presign.ok || !ticket?.uploadUrl || !ticket.key || !ticket.contentType) {
    throw new Error(ticket?.error || "Photo storage is not available right now.");
  }
  await putWithProgress(ticket.uploadUrl, file, ticket.contentType, onProgress);
  const complete = await fetch("/api/admin/media/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminId, area, key: ticket.key }),
  });
  const saved = (await complete.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!complete.ok || !saved?.url) throw new Error(saved?.error || "Could not store the photo.");
  return saved.url;
}

/**
 * Uses Cloudinary only while that store is selected.
 * Uses Amazon S3 when Site Configurations selects it. A failed check does not upload anywhere.
 */
export async function uploadAdminImage(
  file: File,
  area: AdminMediaArea,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const adminId = readAdminId();
  if (!adminId) throw new Error("Photo storage is not available right now.");
  const response = await fetch(`/api/admin/media/mode?adminId=${encodeURIComponent(adminId)}`, {
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as { effective?: string; error?: string } | null;
  if (!response.ok) throw new Error(body?.error || "Photo storage is not available right now.");
  if (body?.effective === "s3") return uploadToS3(file, adminId, area, onProgress);
  if (body?.effective === "cloudinary") return uploadToCloudinary(file, onProgress);
  throw new Error("Photo storage is not available right now.");
}

export const uploadToCloudinary = (file: File, onProgress?: (progress: number) => void): Promise<string> => {
  return new Promise((resolve, reject) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      reject(new Error("Cloudinary credentials are not configured."));
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const xhr = new XMLHttpRequest();

    // Progress tracking
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress?.(progress);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } catch {
          reject(new Error("Invalid response from Cloudinary"));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.error?.message || "Upload failed"));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
    xhr.send(formData);
  });
};
