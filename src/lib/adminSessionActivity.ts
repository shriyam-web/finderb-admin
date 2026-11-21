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
    const headers = new Headers({ "Content-Type": "application/json" });
    try {
      const raw = localStorage.getItem("admin_session");
      const token = raw ? String((JSON.parse(raw) as { token?: string }).token || "") : "";
      if (token) headers.set("x-admin-session", token);
    } catch {
      /* ignore */
    }
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...payload, action }),
      keepalive: action === "end",
    });
    const body = (await response.json().catch(() => null)) as { sessionToken?: string } | null;
    if (body?.sessionToken) {
      const raw = localStorage.getItem("admin_session");
      if (raw) {
        const session = JSON.parse(raw) as { token?: string };
        session.token = body.sessionToken;
        localStorage.setItem("admin_session", JSON.stringify(session));
      }
    }
  } catch {
    /* ignore */
  }
}
