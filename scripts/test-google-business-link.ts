/**
 * Tests for Google Business link helpers.
 * Run: npx tsx scripts/test-google-business-link.ts
 */
import {
  extractPlaceIdFromMapsUrl,
  extractPlaceNameFromMapsUrl,
  googleBusinessToAiFields,
  googleOpeningHoursToTimings,
  googleTypeToCategoryHint,
  mapNominatimToAddress,
  type GoogleBusinessExtract,
} from "../src/lib/googleBusinessLink";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}`, detail ?? "");
  }
}

console.log("extractPlaceNameFromMapsUrl");
check(
  "decodes place slug",
  extractPlaceNameFromMapsUrl(
    "https://www.google.com/maps/place/Cafe+Coffee+Day/@28.63,77.21,17z",
  ) === "Cafe Coffee Day",
);

console.log("\nextractPlaceIdFromMapsUrl");
check(
  "reads place_id query",
  extractPlaceIdFromMapsUrl(
    "https://www.google.com/maps/search/?api=1&query=place_id:ChIJtestplaceid1234567890ab",
  ) === "ChIJtestplaceid1234567890ab",
);

console.log("\ngoogleTypeToCategoryHint");
check(
  "maps restaurant type",
  googleTypeToCategoryHint(["restaurant", "point_of_interest"]) ===
    "Restaurant",
);

console.log("\ngoogleOpeningHoursToTimings");
{
  const timings = googleOpeningHoursToTimings({
    periods: [
      { open: { day: 1, time: "0900" }, close: { day: 1, time: "1800" } },
      { open: { day: 0, time: "1000" }, close: { day: 0, time: "1400" } },
    ],
  });
  check("monday open", timings?.Monday.open === "09:00" && !timings.Monday.isClosed);
  check("sunday open", timings?.Sunday.open === "10:00" && !timings.Sunday.isClosed);
  check("tuesday closed", timings?.Tuesday.isClosed === true);
}

console.log("\nmapNominatimToAddress");
{
  const mapped = mapNominatimToAddress({
    display_name: "12 MG Road, New Delhi, Delhi, India",
    address: {
      house_number: "12",
      road: "MG Road",
      suburb: "Connaught Place",
      city: "New Delhi",
      state: "Delhi",
      country: "India",
      postcode: "110001",
    },
  });
  check("street line", mapped.addressLine1 === "12 MG Road", mapped);
  check("city", mapped.city === "New Delhi");
}

console.log("\ngoogleBusinessToAiFields");
{
  const extract: GoogleBusinessExtract = {
    sourceUrl: "https://maps.app.goo.gl/abc",
    resolvedUrl: "https://www.google.com/maps/place/Test",
    mapsUrl: "https://maps.google.com/?cid=1",
    name: "Test Cafe",
    phone: "+91 98123 45678",
    website: "https://example.com",
    about: "A cozy cafe in CP",
    categoryHint: "Cafe",
    addressLine1: "12 MG Road",
    addressLine2: "",
    city: "New Delhi",
    state: "Delhi",
    country: "India",
    postalCode: "110001",
    latitude: 28.63,
    longitude: 77.21,
    placeId: "",
    rating: 4.5,
    photos: ["https://example.com/p1.jpg"],
    photoReferences: ["ref1"],
    facebookUrl: "https://facebook.com/test",
    instagramUrl: "https://instagram.com/test",
    youtubeUrl: "",
    timings: null,
    enrichedVia: "places_api",
    notes: ["Enriched with Google Places API."],
    missingHints: [],
  };
  const fields = googleBusinessToAiFields(extract);
  check("businessName", fields.businessName === "Test Cafe");
  check("mobile digits", fields.mobile === "9812345678");
  check("about", fields.about === "A cozy cafe in CP");
  check("mapsUrl", fields.mapsUrl.includes("maps.google.com"));
  check("photos", fields.photos.length === 1);
  check("instagram", fields.instagramUrl.includes("instagram.com"));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
