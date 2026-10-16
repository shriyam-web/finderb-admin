export function waitingLabel(value: string | null | undefined, now = new Date()): string {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const elapsed = Math.max(0, now.getTime() - then);
  const days = Math.floor(elapsed / 86_400_000);
  if (days >= 1) return days === 1 ? "Waiting 1 day" : `Waiting ${days} days`;
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours >= 1) return hours === 1 ? "Waiting 1 hour" : `Waiting ${hours} hours`;
  return "Waiting less than an hour";
}

export function byOldestWait<T extends { waitingSince: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aTime = a.waitingSince ? new Date(a.waitingSince).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.waitingSince ? new Date(b.waitingSince).getTime() : Number.POSITIVE_INFINITY;
    const aSafe = Number.isNaN(aTime) ? Number.POSITIVE_INFINITY : aTime;
    const bSafe = Number.isNaN(bTime) ? Number.POSITIVE_INFINITY : bTime;
    return aSafe - bSafe;
  });
}
