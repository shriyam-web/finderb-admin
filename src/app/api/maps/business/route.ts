import { NextResponse } from "next/server";
import {
  extractGoogleBusinessFromUrl,
  googleBusinessToAiFields,
} from "../../../../lib/googleBusinessLink";
import { resolveGalleryImages } from "../../../../lib/rehostRemoteImage";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const rawUrl = body.url?.trim() || "";
    if (!rawUrl) {
      return NextResponse.json(
        { success: false, error: "Paste a Google Business / Maps link." },
        { status: 400 },
      );
    }

    const extract = await extractGoogleBusinessFromUrl(rawUrl);

    // Re-host Place Photo URLs immediately so the Quick Onboard preview (and
    // later create) use durable CDN images — browser <img> cannot reliably load
    // keyed maps.googleapis.com/place/photo URLs.
    if (extract.photos?.length) {
      const hosted = await resolveGalleryImages(extract.photos, 5);
      if (hosted.length) {
        extract.photos = hosted;
        extract.notes = [
          ...(extract.notes || []).filter(
            (n) => !/^Fetched \d+ photo/i.test(n),
          ),
          `Fetched and saved ${hosted.length} photo(s).`,
        ];
      } else {
        extract.notes = [
          ...(extract.notes || []),
          "Photos were found on Google but could not be saved — try again or add images manually.",
        ];
        extract.photos = [];
      }
    }

    const fields = googleBusinessToAiFields(extract);

    if (!fields.businessName && !fields.addressLine1) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not read business details from this link. Open the place in Google Maps → Share → Copy link, then try again.",
          extract,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      fields,
      extract,
      message:
        extract.missingHints.length > 0
          ? `Auto-filled available fields. Still needed (required): ${extract.missingHints.join(", ")}.`
          : "Business details loaded. Review category and create.",
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "The Google link took too long to resolve."
        : error instanceof Error
          ? error.message
          : "Could not read this Google Business link.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
