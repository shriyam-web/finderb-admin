import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPublicSiteUrl } from "../../../lib/site";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function targetsUsers(audience: unknown): boolean {
  if (!Array.isArray(audience)) return false;
  return audience.some((item) => {
    const value = String(item).trim().toLowerCase();
    return value === "users" || value === "all";
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      message?: string;
      audiences?: string[];
    };

    const title = String(body.title || "").trim();
    const message = String(body.message || "").trim();
    const audiences = Array.isArray(body.audiences)
      ? body.audiences.filter((item) => item === "Users" || item === "Merchants")
      : [];

    if (!title || !message || audiences.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Add a title, message, and at least one audience.",
        },
        { status: 400 },
      );
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("broadcasts")
      .insert({
        title,
        message,
        target_audience: audiences,
      })
      .select("id, title, message, target_audience, created_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || "Failed to save broadcast." },
        { status: 500 },
      );
    }

    let pushSent = 0;
    let pushNote: string | null = null;

    if (targetsUsers(audiences)) {
      try {
        const dispatchHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
        };
        const secret = process.env.FINDERB_DISPATCH_SECRET?.trim();
        if (secret) {
          dispatchHeaders["x-finderb-dispatch"] = secret;
        }

        const dispatchRes = await fetch(
          `${getPublicSiteUrl()}/api/notifications/dispatch`,
          {
            method: "POST",
            headers: dispatchHeaders,
            body: JSON.stringify({ broadcastId: data.id }),
          },
        );
        const dispatchJson = (await dispatchRes.json().catch(() => null)) as {
          success?: boolean;
          sent?: number;
          skipped?: string;
          error?: string;
        } | null;

        if (dispatchJson?.success) {
          pushSent = Number(dispatchJson.sent || 0);
          if (dispatchJson.skipped === "no-token-table") {
            pushNote =
              "Saved. Run supabase/user_notifications.sql so app push tokens can be stored.";
          } else if (pushSent === 0) {
            pushNote =
              "Saved and visible in the FinderB app. Push alerts go out after users open the app once while signed in.";
          }
        } else {
          pushNote =
            dispatchJson?.error ||
            "Saved. The app inbox will show it; push dispatch did not complete.";
        }
      } catch (dispatchError) {
        console.error("[admin broadcasts] dispatch", dispatchError);
        pushNote =
          "Saved. The app inbox will show it; live site push dispatch could not be reached.";
      }
    }

    return NextResponse.json({
      success: true,
      broadcast: data,
      pushSent,
      message:
        pushNote ||
        (targetsUsers(audiences)
          ? `Broadcast sent. ${pushSent} app device${pushSent === 1 ? "" : "s"} notified.`
          : "Broadcast sent to merchants."),
    });
  } catch (error) {
    console.error("[admin broadcasts]", error);
    return NextResponse.json(
      { success: false, error: "Could not dispatch broadcast." },
      { status: 500 },
    );
  }
}
