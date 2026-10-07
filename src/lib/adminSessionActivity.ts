"use client";

type SessionPayload = { adminId: string; loginLogId: string };

function readPayload(): SessionPayload | null {
  try {
    const raw = localStorage.getItem("admin_session");
    if (!raw) return null;
    const session = JSON.parse(raw) as { id?: string; loginLogId?: string };
    if (!session.id || !session.loginLogId) return null;
    return { adminId: session.id, loginLogId: session.loginLogId };
  } catch {
    return null;
  }
}

export async function reportAdminSession(action: "heartbeat" | "end") {
  const payload = readPayload();
  if (!payload) return;
  try {
    await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, action }),
      keepalive: action === "end",
    });
  } catch {
    /* ignore */
  }
}
