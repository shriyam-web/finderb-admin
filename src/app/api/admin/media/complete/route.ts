import { NextResponse } from "next/server";
import { canEditTab } from "../../../../../lib/adminTabAccess";
import {
  amazonImageStorageActive,
  isAdminMediaArea,
  loadEnabledAdmin,
} from "../../../../../lib/mediaEnv";
import { finishIncomingImage } from "../../../../../lib/mediaObject";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    adminId?: unknown;
    area?: unknown;
    key?: unknown;
  } | null;
  const admin = await loadEnabledAdmin(String(body?.adminId || ""));
  if (!admin || !isAdminMediaArea(body?.area) || !canEditTab(admin, body.area)) {
    return NextResponse.json({ error: "You cannot upload this photo." }, { status: 403 });
  }
  if (!(await amazonImageStorageActive())) {
    return NextResponse.json({ error: "Amazon storage is not the active photo store." }, { status: 409 });
  }
  const finished = await finishIncomingImage(String(body?.key || ""));
  if (!finished.ok) return NextResponse.json({ error: finished.error }, { status: 400 });
  return NextResponse.json({ url: finished.url });
}
