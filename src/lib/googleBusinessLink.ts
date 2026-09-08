import {
  extractGoogleMapsCoordinates,
  isAllowedGoogleMapsHost,
  type MapCoordinates,
} from "./googleMapsCoordinates";
import type { QuickOnboardAiFields } from "./quickOnboard";

const SHORT_MAP_HOST = "maps.app.goo.gl";
export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type DayHours = {
  isClosed: boolean;
  open: string;
  close: string;
  is24Hours?: boolean;
};
export type WeekTimings = Record<(typeof WEEKDAYS)[number], DayHours>;

export type GoogleBusinessExtract = {
  sourceUrl: string;
  resolvedUrl: string;
  mapsUrl: string;
  name: string;
  phone: string;
  website: string;
  about: string;
  categoryHint: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string;
  rating: number | null;
  photos: string[];
  photoReferences: string[];
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  timings: WeekTimings | null;
  enrichedVia: "url+nominatim" | "places_api" | "url_only";
  notes: string[];
  missingHints: string[];
};

function digitsPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length >= 12) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length > 10) digits = digits.slice(-10);
  return digits.slice(0, 10);
}

function isLikelyIndianMobile(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(digits);
}

/** Decode `/place/Business+Name/` slug from a Maps URL. */
export function extractPlaceNameFromMapsUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const match = url.pathname.match(/\/place\/([^/@]+)/i);
    if (!match?.[1]) return "";
    return decodeURIComponent(match[1].replace(/\+/g, " "))
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

/** Pull ChIJ… place_id when present in the URL. */
export function extractPlaceIdFromMapsUrl(rawUrl: string): string {
  try {
    const decoded = decodeURIComponent(rawUrl);
    const q = decoded.match(/[?&](?:q|query)=place_id:([A-Za-z0-9_-]+)/i);
    if (q?.[1]) return q[1];
    const param = decoded.match(/[?&]place_id=([A-Za-z0-9_-]+)/i);
    if (param?.[1]) return param[1];
    const inline = decoded.match(/\b(ChIJ[A-Za-z0-9_-]{20,})\b/);
    if (inline?.[1]) return inline[1];
  } catch {
    // ignore
  }
  return "";
}

export async function resolveGoogleMapsUrl(rawUrl: string): Promise<{
  resolvedUrl: string;
  coordinates: MapCoordinates | null;
  name: string;
  placeId: string;
}> {
  let mapUrl: URL;
  try {
    mapUrl = new URL(rawUrl.trim());
  } catch {
    throw new Error("Enter a valid Google Maps / Business URL.");
  }

  if (
    mapUrl.protocol !== "https:" ||
    !isAllowedGoogleMapsHost(mapUrl.hostname)
  ) {
    throw new Error("Only Google Maps / Business links are supported.");
  }

  let resolvedUrl = mapUrl.toString();
  if (mapUrl.hostname.toLowerCase() === SHORT_MAP_HOST) {
    const response = await fetch(resolvedUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "FinderB Admin Quick Onboard" },
    });
    const finalUrl = new URL(response.url);
    if (!isAllowedGoogleMapsHost(finalUrl.hostname)) {
      throw new Error("The shortened link is not a Google Maps link.");
    }
    resolvedUrl = finalUrl.toString();
  }

  return {
    resolvedUrl,
    coordinates: extractGoogleMapsCoordinates(resolvedUrl),
    name: extractPlaceNameFromMapsUrl(resolvedUrl),
    placeId: extractPlaceIdFromMapsUrl(resolvedUrl),
  };
}

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  city_district?: string;
  county?: string;
  state?: string;
  state_district?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
};

type NominatimResponse = {
  display_name?: string;
  name?: string;
  address?: NominatimAddress;
};

export function mapNominatimToAddress(data: NominatimResponse): {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
} {
  const a = data.address || {};
  const street =
    [a.house_number, a.road || a.pedestrian].filter(Boolean).join(" ") ||
    a.neighbourhood ||
    "";
  const line2 = [a.suburb, a.neighbourhood].filter(Boolean).join(", ");
  const city =
    a.city || a.town || a.village || a.city_district || a.county || "";
  let state = a.state || a.state_district || "";
  if (state === "National Capital Territory of Delhi" || state === "NCT") {
    state = "Delhi";
  }
  const iso = (a as Record<string, string>)["ISO3166-2-lvl4"] || "";
  if (!state && iso.startsWith("IN-")) {
    const code = iso.slice(3).toUpperCase();
    const byCode: Record<string, string> = {
      DL: "Delhi",
      MH: "Maharashtra",
      KA: "Karnataka",
      TN: "Tamil Nadu",
      TG: "Telangana",
      AP: "Andhra Pradesh",
      GJ: "Gujarat",
      RJ: "Rajasthan",
      UP: "Uttar Pradesh",
      WB: "West Bengal",
      HR: "Haryana",
      PB: "Punjab",
      KL: "Kerala",
      MP: "Madhya Pradesh",
      BR: "Bihar",
      OR: "Odisha",
      OD: "Odisha",
      AS: "Assam",
      JH: "Jharkhand",
      CT: "Chhattisgarh",
      CG: "Chhattisgarh",
      UK: "Uttarakhand",
      UL: "Uttarakhand",
      HP: "Himachal Pradesh",
      GA: "Goa",
    };
    state = byCode[code] || "";
  }
  if (!state && data.display_name) {
    const parts = data.display_name.split(",").map((p) => p.trim());
    const maybeState = parts.find((p) =>
      /^(Delhi|Maharashtra|Karnataka|Tamil Nadu|Telangana|Gujarat|Rajasthan|Uttar Pradesh|West Bengal|Haryana|Punjab|Kerala|Madhya Pradesh|Bihar|Odisha|Assam|Goa)$/i.test(
        p,
      ),
    );
    if (maybeState) state = maybeState;
  }
  const country = a.country || (a.country_code === "in" ? "India" : "") || "";
  const postalCode = a.postcode || "";

  const addressLine2 =
    line2 && street && !street.toLowerCase().includes(line2.toLowerCase())
      ? line2
      : a.suburb && a.suburb !== city
        ? a.suburb
        : "";

  return {
    addressLine1: street || (data.display_name || "").split(",")[0] || "",
    addressLine2,
    city,
    state,
    country: country || "India",
    postalCode,
  };
}

export async function reverseGeocodeNominatim(
  latitude: number,
  longitude: number,
): Promise<NominatimResponse | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "FinderBAdmin/1.0 (quick-onboard; contact@finderb.com)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as NominatimResponse;
}

/** Convert Google Places type snake_case into a readable category hint. */
export function googleTypeToCategoryHint(types: string[] | undefined): string {
  if (!types?.length) return "";
  const skip = new Set([
    "point_of_interest",
    "establishment",
    "premise",
    "geocode",
    "political",
    "route",
    "street_address",
  ]);
  const primary = types.find((t) => !skip.has(t)) || types[0];
  return primary
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type PlacesDetails = {
  name?: string;
  formatted_address?: string;
  international_phone_number?: string;
  formatted_phone_number?: string;
  website?: string;
  url?: string;
  rating?: number;
  types?: string[];
  editorial_summary?: { overview?: string; language?: string };
  photos?: Array<{ photo_reference?: string; height?: number; width?: number }>;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
    periods?: Array<{
      open?: { day?: number; time?: string };
      close?: { day?: number; time?: string };
    }>;
  };
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  geometry?: { location?: { lat: number; lng: number } };
  place_id?: string;
};

function parseAddressComponents(
  components: PlacesDetails["address_components"],
): {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
} {
  if (!components?.length) {
    return {
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      country: "India",
      postalCode: "",
    };
  }
  const get = (...types: string[]) =>
    components.find((c) => types.some((t) => c.types.includes(t)))?.long_name ||
    "";

  const streetNumber = get("street_number");
  const route = get("route");
  const sublocality =
    get("sublocality_level_1", "sublocality", "neighborhood") || "";
  const city =
    get("locality", "postal_town") ||
    get("administrative_area_level_2") ||
    "";
  let state = get("administrative_area_level_1");
  if (state.includes("Delhi")) state = "Delhi";
  const country = get("country") || "India";
  const postalCode = get("postal_code");

  return {
    addressLine1: [streetNumber, route].filter(Boolean).join(" ") || sublocality,
    addressLine2: route ? sublocality : "",
    city,
    state,
    country,
    postalCode,
  };
}

function formatGoogleTime(raw?: string): string {
  if (!raw || !/^\d{3,4}$/.test(raw)) return "09:00";
  const padded = raw.padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

/** Convert Google Places opening_hours into FinderB week timings. */
export function googleOpeningHoursToTimings(
  openingHours: PlacesDetails["opening_hours"] | undefined,
): WeekTimings | null {
  if (!openingHours?.periods?.length) return null;

  // Google: 0=Sunday … 6=Saturday
  const googleDays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ] as const;

  const base = WEEKDAYS.reduce((acc, day) => {
    acc[day] = { isClosed: true, open: "09:00", close: "18:00" };
    return acc;
  }, {} as WeekTimings);

  for (const period of openingHours.periods) {
    const openDay = period.open?.day;
    if (openDay == null || openDay < 0 || openDay > 6) continue;
    const dayName = googleDays[openDay];
    if (!WEEKDAYS.includes(dayName as (typeof WEEKDAYS)[number])) continue;
    // 24h open: open only, no close
    if (!period.close) {
      base[dayName as (typeof WEEKDAYS)[number]] = {
        isClosed: false,
        open: "00:00",
        close: "23:59",
        is24Hours: true,
      };
      continue;
    }
    base[dayName as (typeof WEEKDAYS)[number]] = {
      isClosed: false,
      open: formatGoogleTime(period.open?.time),
      close: formatGoogleTime(period.close?.time),
    };
  }

  return base;
}

export function buildPlacePhotoUrl(
  photoReference: string,
  apiKey: string,
  maxWidth = 1200,
): string {
  const url = new URL("https://maps.googleapis.com/maps/api/place/photo");
  url.searchParams.set("maxwidth", String(maxWidth));
  url.searchParams.set("photo_reference", photoReference);
  url.searchParams.set("key", apiKey);
  return url.toString();
}

export async function extractSocialLinksFromWebsite(
  website: string,
): Promise<{ facebookUrl: string; instagramUrl: string; youtubeUrl: string }> {
  const empty = { facebookUrl: "", instagramUrl: "", youtubeUrl: "" };
  if (!website.trim()) return empty;

  let pageUrl: URL;
  try {
    pageUrl = new URL(website);
  } catch {
    return empty;
  }
  if (pageUrl.protocol !== "http:" && pageUrl.protocol !== "https:") {
    return empty;
  }

  try {
    const res = await fetch(pageUrl.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "FinderBAdmin/1.0 (quick-onboard)",
        Accept: "text/html",
      },
      cache: "no-store",
    });
    if (!res.ok) return empty;
    const html = await res.text();
    const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) =>
      m[1].trim(),
    );

    const pick = (hostPart: string) => {
      const hit = hrefs.find((h) => {
        try {
          const u = new URL(h, pageUrl);
          return u.hostname.toLowerCase().includes(hostPart);
        } catch {
          return false;
        }
      });
      if (!hit) return "";
      try {
        return new URL(hit, pageUrl).toString();
      } catch {
        return hit;
      }
    };

    return {
      facebookUrl: pick("facebook.com") || pick("fb.com"),
      instagramUrl: pick("instagram.com"),
      youtubeUrl: pick("youtube.com") || pick("youtu.be"),
    };
  } catch {
    return empty;
  }
}

export async function fetchGooglePlaceDetails(opts: {
  apiKey: string;
  placeId?: string;
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<PlacesDetails | null> {
  const { apiKey } = opts;
  let placeId = opts.placeId || "";

  if (!placeId && opts.name) {
    const findUrl = new URL(
      "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
    );
    findUrl.searchParams.set("input", opts.name);
    findUrl.searchParams.set("inputtype", "textquery");
    findUrl.searchParams.set(
      "fields",
      "place_id,name,formatted_address,geometry",
    );
    if (
      opts.latitude != null &&
      opts.longitude != null &&
      Number.isFinite(opts.latitude) &&
      Number.isFinite(opts.longitude)
    ) {
      findUrl.searchParams.set(
        "locationbias",
        `point:${opts.latitude},${opts.longitude}`,
      );
    }
    findUrl.searchParams.set("key", apiKey);

    const findRes = await fetch(findUrl.toString(), {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (findRes.ok) {
      const findJson = (await findRes.json()) as {
        candidates?: Array<{ place_id?: string }>;
        status?: string;
      };
      placeId = findJson.candidates?.[0]?.place_id || "";
    }
  }

  if (!placeId) return null;

  const detailsUrl = new URL(
    "https://maps.googleapis.com/maps/api/place/details/json",
  );
  detailsUrl.searchParams.set("place_id", placeId);
  detailsUrl.searchParams.set(
    "fields",
    [
      "place_id",
      "name",
      "formatted_address",
      "address_component",
      "international_phone_number",
      "formatted_phone_number",
      "website",
      "url",
      "types",
      "geometry",
      "rating",
      "editorial_summary",
      "photos",
      "opening_hours",
    ].join(","),
  );
  detailsUrl.searchParams.set("key", apiKey);

  const detailsRes = await fetch(detailsUrl.toString(), {
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!detailsRes.ok) return null;
  const detailsJson = (await detailsRes.json()) as {
    result?: PlacesDetails;
    status?: string;
    error_message?: string;
  };
  if (detailsJson.status && detailsJson.status !== "OK") return null;
  return detailsJson.result || null;
}

export async function extractGoogleBusinessFromUrl(
  rawUrl: string,
  options?: { placesApiKey?: string | null },
): Promise<GoogleBusinessExtract> {
  const resolved = await resolveGoogleMapsUrl(rawUrl);
  const notes: string[] = [];
  const missingHints: string[] = [];

  let name = resolved.name;
  let phone = "";
  let website = "";
  let about = "";
  let mapsUrl = resolved.resolvedUrl;
  let categoryHint = "";
  let addressLine1 = "";
  let addressLine2 = "";
  let city = "";
  let state = "";
  let country = "India";
  let postalCode = "";
  let placeId = resolved.placeId;
  let latitude = resolved.coordinates?.latitude ?? null;
  let longitude = resolved.coordinates?.longitude ?? null;
  let rating: number | null = null;
  let photos: string[] = [];
  let photoReferences: string[] = [];
  let facebookUrl = "";
  let instagramUrl = "";
  let youtubeUrl = "";
  let timings: WeekTimings | null = null;
  let enrichedVia: GoogleBusinessExtract["enrichedVia"] = "url_only";

  const apiKey =
    options?.placesApiKey?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    "";

  if (apiKey) {
    try {
      const details = await fetchGooglePlaceDetails({
        apiKey,
        placeId: placeId || undefined,
        name: name || undefined,
        latitude,
        longitude,
      });
      if (details) {
        enrichedVia = "places_api";
        name = details.name || name;
        placeId = details.place_id || placeId;
        const rawPhone =
          details.international_phone_number ||
          details.formatted_phone_number ||
          "";
        const parsedPhone = digitsPhone(rawPhone);
        phone = isLikelyIndianMobile(parsedPhone) ? parsedPhone : "";
        if (rawPhone && !phone) {
          notes.push(
            "Listed phone is not a standard Indian mobile — enter mobile manually.",
          );
        }
        website = details.website || "";
        mapsUrl = details.url || resolved.resolvedUrl;
        about = details.editorial_summary?.overview?.trim() || "";
        rating =
          typeof details.rating === "number" && Number.isFinite(details.rating)
            ? details.rating
            : null;
        categoryHint = googleTypeToCategoryHint(details.types);
        const parsed = parseAddressComponents(details.address_components);
        addressLine1 = parsed.addressLine1;
        addressLine2 = parsed.addressLine2;
        city = parsed.city;
        state = parsed.state;
        country = parsed.country || "India";
        postalCode = parsed.postalCode;
        if (!addressLine1 && details.formatted_address) {
          addressLine1 = details.formatted_address.split(",")[0] || "";
        }
        if (details.geometry?.location) {
          latitude = details.geometry.location.lat;
          longitude = details.geometry.location.lng;
        }
        timings = googleOpeningHoursToTimings(details.opening_hours);
        photoReferences = (details.photos || [])
          .map((p) => p.photo_reference || "")
          .filter(Boolean)
          .slice(0, 5);
        photos = photoReferences.map((ref) =>
          buildPlacePhotoUrl(ref, apiKey, 1200),
        );
        notes.push("Enriched with Google Places API.");
        if (about) notes.push("Description from Google editorial summary.");
        if (photos.length) notes.push(`Fetched ${photos.length} photo(s).`);
        if (timings) notes.push("Opening hours mapped to timings.");
      } else {
        notes.push("Places API returned no match — using link + geocode.");
      }
    } catch {
      notes.push("Places API lookup failed — using link + geocode.");
    }
  }

  if ((!addressLine1 || !city) && latitude != null && longitude != null) {
    try {
      const geo = await reverseGeocodeNominatim(latitude, longitude);
      if (geo) {
        const mapped = mapNominatimToAddress(geo);
        if (!name) name = geo.name || name;
        if (!addressLine1) addressLine1 = mapped.addressLine1;
        if (!addressLine2) addressLine2 = mapped.addressLine2;
        if (!city) city = mapped.city;
        if (!state) state = mapped.state;
        if (!country) country = mapped.country || "India";
        if (!postalCode) postalCode = mapped.postalCode;
        if (enrichedVia === "url_only") enrichedVia = "url+nominatim";
        notes.push("Address filled from map coordinates (OpenStreetMap).");
      }
    } catch {
      notes.push("Reverse geocode failed — fill address manually.");
    }
  }

  if (website) {
    try {
      const social = await extractSocialLinksFromWebsite(website);
      facebookUrl = social.facebookUrl;
      instagramUrl = social.instagramUrl;
      youtubeUrl = social.youtubeUrl;
      const found = [
        facebookUrl && "Facebook",
        instagramUrl && "Instagram",
        youtubeUrl && "YouTube",
      ].filter(Boolean);
      if (found.length) {
        notes.push(`Social links found on website: ${found.join(", ")}.`);
      } else {
        notes.push("No social links found on website homepage.");
      }
    } catch {
      notes.push("Could not scan website for social links.");
    }
  }

  // Only mandatory create fields — optional extras (about, photos, social, hours,
  // owner) must not appear in "Still needed".
  const usablePhone = isLikelyIndianMobile(digitsPhone(phone))
    ? digitsPhone(phone)
    : "";
  if (!name) missingHints.push("business name");
  if (!usablePhone) missingHints.push("phone");
  if (!addressLine1) missingHints.push("address");
  if (!city) missingHints.push("city");
  if (!state) missingHints.push("state");
  if (!categoryHint) missingHints.push("category");

  if (!apiKey) {
    notes.push(
      "Set GOOGLE_MAPS_API_KEY for phone, photos, description, hours, and richer details.",
    );
  }

  return {
    sourceUrl: rawUrl.trim(),
    resolvedUrl: resolved.resolvedUrl,
    mapsUrl,
    name,
    phone,
    website,
    about,
    categoryHint,
    addressLine1,
    addressLine2,
    city,
    state,
    country: country || "India",
    postalCode,
    latitude,
    longitude,
    placeId,
    rating,
    photos,
    photoReferences,
    facebookUrl,
    instagramUrl,
    youtubeUrl,
    timings,
    enrichedVia,
    notes,
    missingHints,
  };
}

/** Map extracted GBP data into Quick Onboard AI field shape. */
export function googleBusinessToAiFields(
  extract: GoogleBusinessExtract,
): QuickOnboardAiFields {
  const phone = digitsPhone(extract.phone);
  const noteParts = [
    ...extract.notes,
    extract.website ? `Website: ${extract.website}` : "",
    extract.mapsUrl ? `Maps: ${extract.mapsUrl}` : "",
    extract.postalCode ? `PIN: ${extract.postalCode}` : "",
    extract.latitude != null && extract.longitude != null
      ? `Coords: ${extract.latitude}, ${extract.longitude}`
      : "",
    extract.rating != null ? `Rating: ${extract.rating}` : "",
    extract.sourceUrl ? `Source: ${extract.sourceUrl}` : "",
  ].filter(Boolean);

  return {
    ownerFullName: "",
    loginEmail: "",
    emailUnavailable: true,
    mobile: isLikelyIndianMobile(phone) ? phone : "",
    businessName: extract.name || "",
    displayName: extract.name || "",
    category: extract.categoryHint || "",
    subcategory: "",
    addressLine1: extract.addressLine1 || "",
    addressLine2: extract.addressLine2 || "",
    city: extract.city || "",
    state: extract.state || "",
    country: extract.country || "India",
    publicPhone: isLikelyIndianMobile(phone) ? phone : "",
    activateImmediately: false,
    notes: noteParts.join(" · "),
    about: extract.about || "",
    website: extract.website || "",
    mapsUrl: extract.mapsUrl || extract.resolvedUrl || extract.sourceUrl || "",
    facebookUrl: extract.facebookUrl || "",
    instagramUrl: extract.instagramUrl || "",
    youtubeUrl: extract.youtubeUrl || "",
    latitude: extract.latitude,
    longitude: extract.longitude,
    rating: extract.rating,
    photos: extract.photos || [],
    timings: extract.timings,
  };
}
