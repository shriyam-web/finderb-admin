"use client";

import { useRef, useState } from "react";
import AdminOverlay from "./AdminOverlay";

const VIEW = 280;
const OUTPUT = 512;

type Crop = {
  url: string;
  width: number;
  height: number;
  zoom: number;
  x: number;
  y: number;
};

type Laid = { drawW: number; drawH: number; left: number; top: number; x: number; y: number };

function sessionToken(): string {
  try {
    const raw = localStorage.getItem("admin_session");
    return raw ? String((JSON.parse(raw) as { token?: string }).token || "") : "";
  } catch {
    return "";
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Choose a JPG, PNG, or WebP photo."));
    image.src = url;
  });
}

function layoutCrop(crop: Crop, view: number): Laid {
  const base = Math.max(view / crop.width, view / crop.height);
  const scale = base * crop.zoom;
  const drawW = crop.width * scale;
  const drawH = crop.height * scale;
  const maxX = Math.max(0, (drawW - view) / 2);
  const maxY = Math.max(0, (drawH - view) / 2);
  const x = Math.min(maxX, Math.max(-maxX, crop.x));
  const y = Math.min(maxY, Math.max(-maxY, crop.y));
  return { drawW, drawH, left: (view - drawW) / 2 + x, top: (view - drawH) / 2 + y, x, y };
}

async function postPhoto(body: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch("/api/admin/profile-photo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-session": sessionToken(),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach photo storage. Try again.");
  }
  const result = (await response.json().catch(() => null)) as { error?: string; url?: string | null } | null;
  if (!response.ok) throw new Error(result?.error || "Could not update the profile photo.");
  return result || {};
}

export default function AdminProfilePhoto({
  avatarUrl,
  name,
  onChange,
}: {
  avatarUrl: string | null;
  name: string;
  onChange: (avatarUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [crop, setCrop] = useState<Crop | null>(null);
  const initial = (name.trim() || "A").charAt(0).toUpperCase();

  const closeCrop = () => {
    setCrop((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    imageRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
  };

  const openCrop = async (file: File) => {
    setError("");
    setNote("");
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError("Choose a JPG, PNG, or WebP photo.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      if (Math.min(image.naturalWidth, image.naturalHeight) < 32) {
        URL.revokeObjectURL(url);
        setError("Choose a larger photo.");
        return;
      }
      imageRef.current = image;
      setCrop({ url, width: image.naturalWidth, height: image.naturalHeight, zoom: 1, x: 0, y: 0 });
    } catch (caught) {
      URL.revokeObjectURL(url);
      setError(caught instanceof Error ? caught.message : "Choose a JPG, PNG, or WebP photo.");
    }
  };

  const saveCrop = async () => {
    const image = imageRef.current;
    if (!crop || !image) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const laid = layoutCrop(crop, VIEW);
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare the photo.");
      const ratio = OUTPUT / VIEW;
      context.drawImage(image, laid.left * ratio, laid.top * ratio, laid.drawW * ratio, laid.drawH * ratio);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("Could not prepare the photo.");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not prepare the photo."));
        reader.readAsDataURL(blob);
      });
      const saved = await postPhoto({ action: "save", image: dataUrl });
      if (!saved.url) throw new Error("Could not save the profile photo.");
      onChange(saved.url);
      setNote("Profile photo updated.");
      closeCrop();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the profile photo.");
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async () => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      await postPhoto({ action: "remove" });
      onChange(null);
      setNote("Profile photo removed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove the profile photo.");
    } finally {
      setBusy(false);
    }
  };

  const laid = crop ? layoutCrop(crop, VIEW) : null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-800">Profile photo</p>
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-orange-600 text-lg font-semibold text-white">
            {initial}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="admin-btn-secondary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Saving…" : avatarUrl ? "Change photo" : "Set profile photo"}
          </button>
          {avatarUrl ? (
            <button type="button" className="admin-btn-secondary" disabled={busy} onClick={() => void removePhoto()}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void openCrop(file);
        }}
      />
      <p className="text-xs text-slate-500">Choose a photo, then drag and zoom it into a square.</p>
      {note ? <p className="text-xs text-emerald-700">{note}</p> : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {crop && laid ? (
        <AdminOverlay zClassName="z-[260]">
          <div className="admin-card w-full max-w-md p-5">
            <h2 className="text-base font-semibold text-slate-900">Crop profile photo</h2>
            <p className="mt-1 text-xs text-slate-500">Drag the photo and use the slider. The square is what gets saved.</p>
            <div
              className="relative mx-auto mt-4 overflow-hidden rounded-xl bg-slate-900"
              style={{ width: VIEW, height: VIEW, maxWidth: "100%", touchAction: "none" }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = { px: event.clientX, py: event.clientY, x: crop.x, y: crop.y };
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag) return;
                setCrop((current) =>
                  current
                    ? { ...current, x: drag.x + (event.clientX - drag.px), y: drag.y + (event.clientY - drag.py) }
                    : current,
                );
              }}
              onPointerUp={() => {
                dragRef.current = null;
              }}
            >
              <img
                src={crop.url}
                alt=""
                draggable={false}
                className="absolute max-w-none select-none"
                style={{ width: laid.drawW, height: laid.drawH, left: laid.left, top: laid.top }}
              />
            </div>
            <label className="mt-4 block text-xs font-medium text-slate-600">
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={crop.zoom}
                className="mt-1 w-full"
                onChange={(event) => {
                  const zoom = Number(event.target.value);
                  setCrop((current) => (current ? { ...current, zoom } : current));
                }}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="admin-btn-secondary" disabled={busy} onClick={closeCrop}>
                Cancel
              </button>
              <button type="button" className="admin-btn-primary" disabled={busy} onClick={() => void saveCrop()}>
                {busy ? "Saving…" : "Use this photo"}
              </button>
            </div>
          </div>
        </AdminOverlay>
      ) : null}
    </div>
  );
}
