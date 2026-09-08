import { WEEKDAYS, type DayHours, type WeekTimings } from "./googleBusinessLink";

export type { DayHours, WeekTimings };

export const ALL_DAY_OPEN = "00:00";
export const ALL_DAY_CLOSE = "23:59";
export const DEFAULT_OPEN = "09:00";
export const DEFAULT_CLOSE = "18:00";

export function emptyDayHours(): DayHours {
  return {
    isClosed: false,
    open: DEFAULT_OPEN,
    close: DEFAULT_CLOSE,
    is24Hours: false,
  };
}

export function emptyWeekTimings(): WeekTimings {
  return WEEKDAYS.reduce((acc, day) => {
    acc[day] = emptyDayHours();
    return acc;
  }, {} as WeekTimings);
}

function looksLike24Hours(open: string, close: string): boolean {
  if (open === ALL_DAY_OPEN && (close === ALL_DAY_CLOSE || close === "24:00")) {
    return true;
  }
  return open === ALL_DAY_OPEN && close === ALL_DAY_OPEN;
}

export function normalizeDayHours(raw: unknown): DayHours {
  if (!raw || raw === "Closed") {
    return { ...emptyDayHours(), isClosed: true };
  }

  if (typeof raw === "string") {
    const text = raw.toLowerCase();
    if (text.includes("24") && text.includes("open")) {
      return {
        isClosed: false,
        open: ALL_DAY_OPEN,
        close: ALL_DAY_CLOSE,
        is24Hours: true,
      };
    }
    const match = raw.match(
      /(\d{1,2}:\d{2})\s*[–\-—to]+\s*(\d{1,2}:\d{2})/i,
    );
    if (match) {
      const open = match[1];
      const close = match[2];
      return {
        isClosed: false,
        open,
        close,
        is24Hours: looksLike24Hours(open, close),
      };
    }
    return emptyDayHours();
  }

  if (typeof raw === "object") {
    const slot = raw as {
      isClosed?: boolean;
      closed?: boolean;
      open?: string;
      close?: string;
      is24Hours?: boolean;
    };
    if (slot.isClosed || slot.closed) {
      return { ...emptyDayHours(), isClosed: true, is24Hours: false };
    }
    if (slot.is24Hours) {
      return {
        isClosed: false,
        open: ALL_DAY_OPEN,
        close: ALL_DAY_CLOSE,
        is24Hours: true,
      };
    }
    const open = slot.open || DEFAULT_OPEN;
    const close = slot.close || DEFAULT_CLOSE;
    return {
      isClosed: false,
      open,
      close,
      is24Hours: looksLike24Hours(open, close),
    };
  }

  return emptyDayHours();
}

export function normalizeWeekTimings(timings: unknown): WeekTimings {
  const source =
    timings && typeof timings === "object"
      ? (timings as Record<string, unknown>)
      : {};

  return WEEKDAYS.reduce((acc, day) => {
    acc[day] = normalizeDayHours(source[day]);
    return acc;
  }, {} as WeekTimings);
}

export function applyMondayToAllDays(timings: WeekTimings): WeekTimings {
  const source = timings.Monday;
  if (!source) return timings;
  if (!source.is24Hours && !source.isClosed && (!source.open || !source.close)) {
    return timings;
  }
  return WEEKDAYS.reduce((acc, day) => {
    acc[day] = { ...source };
    return acc;
  }, {} as WeekTimings);
}

export function patchDayHours(
  current: DayHours,
  patch: Partial<DayHours>,
): DayHours {
  if (patch.is24Hours) {
    return {
      open: ALL_DAY_OPEN,
      close: ALL_DAY_CLOSE,
      isClosed: false,
      is24Hours: true,
    };
  }
  if (patch.isClosed) {
    return {
      ...current,
      ...patch,
      isClosed: true,
      is24Hours: false,
    };
  }
  if (patch.is24Hours === false) {
    return { ...current, ...patch, is24Hours: false };
  }
  if (patch.open !== undefined || patch.close !== undefined) {
    return {
      ...current,
      ...patch,
      is24Hours: false,
      isClosed: false,
    };
  }
  return { ...current, ...patch };
}
