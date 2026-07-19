import { NextResponse } from "next/server";
import {
  extractGoogleMapsCoordinates,
  isAllowedGoogleMapsHost,
} from "../../../../lib/googleMapsCoordinates";

const SHORT_MAP_HOST = "maps.app.goo.gl";

export async function POST(request: Request) {
  try {
    const { url: rawUrl } = (await request.json()) as { url?: string };
    if (!rawUrl?.trim()) {
      return NextResponse.json(
        { success: false, error: "Paste a Google Maps link." },
        { status: 400 },
      );
    }

    let mapUrl: URL;
    try {
      mapUrl = new URL(rawUrl.trim());
    } catch {
      return NextResponse.json(
        { success: false, error: "Enter a valid Google Maps URL." },
        { status: 400 },
      );
    }

    if (
      mapUrl.protocol !== "https:" ||
      !isAllowedGoogleMapsHost(mapUrl.hostname)
    ) {
      return NextResponse.json(
        { success: false, error: "Only Google Maps links are supported." },
        { status: 400 },
      );
    }

    let resolvedUrl = mapUrl.toString();
    if (mapUrl.hostname.toLowerCase() === SHORT_MAP_HOST) {
      const response = await fetch(resolvedUrl, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "FinderB Admin" },
      });

      const finalUrl = new URL(response.url);
      if (!isAllowedGoogleMapsHost(finalUrl.hostname)) {
        return NextResponse.json(
          { success: false, error: "The shortened link is not a Google Maps link." },
          { status: 400 },
        );
      }
      resolvedUrl = finalUrl.toString();
    }

    const result = extractGoogleMapsCoordinates(resolvedUrl);
    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Coordinates were not found. In Google Maps, open the exact place or dropped pin, then use Share → Copy link.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "The Maps link took too long to resolve."
        : "Could not read this Google Maps link.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
