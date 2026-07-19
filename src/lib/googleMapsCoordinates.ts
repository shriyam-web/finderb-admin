export type MapCoordinates = {
  latitude: number;
  longitude: number;
};

function validCoordinates(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function coordinates(latitude: string, longitude: string) {
  const parsed = {
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
  return validCoordinates(parsed.latitude, parsed.longitude) ? parsed : null;
}

export function extractGoogleMapsCoordinates(
  rawUrl: string,
): MapCoordinates | null {
  const value = decodeURIComponent(rawUrl);

  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /\/place\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return coordinates(match[1], match[2]);
  }

  return null;
}

export function isAllowedGoogleMapsHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "maps.app.goo.gl" ||
    host === "maps.google.com" ||
    host === "google.com" ||
    host.endsWith(".google.com")
  );
}
