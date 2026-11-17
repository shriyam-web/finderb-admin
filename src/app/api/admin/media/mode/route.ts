import { NextResponse } from "next/server";
import { amazonImageStorageActive, loadEnabledAdmin, publicS3Env } from "../../../../../lib/mediaEnv";

export async function GET(request: Request) {
  const adminId = new URL(request.url).searchParams.get("adminId")?.trim() || "";
  const admin = await loadEnabledAdmin(adminId);
  if (!admin) {
    return NextResponse.json({ error: "Admin session is required." }, { status: 401 });
  }
  const active = await amazonImageStorageActive();
  return NextResponse.json({
    effective: active ? "s3" : "cloudinary",
    s3Configured: publicS3Env().ready,
  });
}
