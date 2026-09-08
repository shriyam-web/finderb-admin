"use client";

import { useState } from "react";
import { WEEKDAYS } from "../lib/googleBusinessLink";
import {
  applyMondayToAllDays,
  normalizeWeekTimings,
  patchDayHours,
  type WeekTimings,
} from "../lib/workingHours";

type Props = {
  value: unknown;
  onChange: (next: WeekTimings) => void;
  onClear?: () => void;
  heading?: string;
  hint?: string;
};

export default function WorkingHoursEditor({
  value,
  onChange,
  onClear,
  heading = "Working hours",
  hint = 'Use "Open 24 hours" for days you never close (e.g. hospitals). Mark a day closed to disable its hours. On Monday, use "Apply same to all days" to copy Monday\'s timings to the rest of the week.',
}: Props) {
  const timings = normalizeWeekTimings(value);
  const [syncMondayToAll, setSyncMondayToAll] = useState(false);
  const monday = timings.Monday;
  const showMondaySync =
    Boolean(monday) &&
    !monday.isClosed &&
    Boolean(monday.is24Hours || (monday.open && monday.close));

  const patchDay = (
    day: (typeof WEEKDAYS)[number],
    patch: Parameters<typeof patchDayHours>[1],
  ) => {
    if (patch.isClosed && day === "Monday") {
      setSyncMondayToAll(false);
    }

    const nextDay = patchDayHours(timings[day], patch);
    const next: WeekTimings = { ...timings, [day]: nextDay };

    if (
      day === "Monday" &&
      syncMondayToAll &&
      !nextDay.isClosed &&
      (nextDay.is24Hours || (nextDay.open && nextDay.close))
    ) {
      onChange(applyMondayToAllDays(next));
      return;
    }

    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-medium text-slate-600">{heading}</span>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            {hint}
          </p>
        </div>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-[11px] font-semibold text-slate-500 hover:text-rose-600"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="space-y-1.5">
        {WEEKDAYS.map((day) => {
          const slot = timings[day];
          const isClosed = Boolean(slot.isClosed);
          const is24Hours = Boolean(slot.is24Hours);
          const timesDisabled = isClosed || is24Hours;

          return (
            <div
              key={day}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <span className="w-10 text-xs font-medium text-slate-700">
                {day.slice(0, 3)}
              </span>
              {is24Hours ? (
                <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                  Open 24 hours
                </span>
              ) : (
                <>
                  <input
                    type="time"
                    value={slot.open || ""}
                    disabled={timesDisabled}
                    onChange={(e) => patchDay(day, { open: e.target.value })}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <span className="text-xs text-slate-400">–</span>
                  <input
                    type="time"
                    value={slot.close || ""}
                    disabled={timesDisabled}
                    onChange={(e) => patchDay(day, { close: e.target.value })}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </>
              )}
              <label className="ml-auto flex items-center gap-1 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={is24Hours}
                  disabled={isClosed}
                  onChange={(e) => patchDay(day, { is24Hours: e.target.checked })}
                />
                24 hrs
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={isClosed}
                  disabled={is24Hours}
                  onChange={(e) => patchDay(day, { isClosed: e.target.checked })}
                />
                Closed
              </label>
              {day === "Monday" && showMondaySync ? (
                <label className="flex w-full items-center gap-1.5 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={syncMondayToAll}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSyncMondayToAll(true);
                        onChange(applyMondayToAllDays(timings));
                        return;
                      }
                      setSyncMondayToAll(false);
                    }}
                    className="rounded border-slate-300 text-teal-700 focus:ring-teal-600/20"
                  />
                  Apply same to all days
                </label>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
