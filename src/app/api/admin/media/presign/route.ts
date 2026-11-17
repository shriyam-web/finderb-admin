import { NextResponse } from "next/server";
import { canEditTab } from "../../../../../lib/adminTabAccess";
import {
  amazonImageStorageActive,
  isAdminMediaArea,
  loadEnabledAdmin,
} from "../../../../../lib/mediaEnv";
import { newIncomingKey, presignIncomingUpload } from "../../../../../lib/mediaObject";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    adminId?: unknown;
    area?: unknown;
    bytes?: unknown;
  } | null;
  const admin = await loadEnabledAdmin(String(body?.adminId || ""));
  if (!admin || !isAdminMediaArea(body?.area) || !canEditTab(admin, body.area)) {
    return NextResponse.json({ error: "You cannot upload this photo." }, { status: 403 });
  }
  if (!(await amazonImageStorageActive())) {
    return NextResponse.json({ error: "Amazon storage is not the active photo store." }, { status: 409 });
  }
  const bytes = Number(body?.bytes);
  if (!Number.isInteger(bytes) || bytes < 32 || bytes > 8_000_000) {
    return NextResponse.json({ error: "This photo is too large. Choose a smaller one." }, { status: 400 });
  }
  const key = newIncomingKey();
  const signed = await presignIncomingUpload(key, bytes);
  if (!signed) {
    return NextResponse.json({ error: "Photo storage is not available right now." }, { status: 503 });
  }
  return NextResponse.json({ key, uploadUrl: signed.uploadUrl, contentType: signed.contentType });
}
