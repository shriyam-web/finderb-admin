"use client";

import { useEffect, useRef } from "react";

type OtpCodeBoxesProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
};

/** One box per digit. Typing moves forward, Backspace moves back, and a pasted code fills every box. */
export default function OtpCodeBoxes({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  autoFocus,
  invalid,
}: OtpCodeBoxesProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.replace(/\D/g, "").slice(0, length);

  useEffect(() => {
    if (autoFocus && !disabled) refs.current[Math.min(digits.length, length - 1)]?.focus();
    // Only refocus when the boxes become usable, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, disabled]);

  const setDigits = (next: string, focusIndex: number) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    refs.current[Math.min(focusIndex, length - 1)]?.focus();
    if (clean.length === length) onComplete?.(clean);
  };

  return (
    <div className="flex justify-between gap-2 sm:gap-3" role="group" aria-label={`${length}-digit code`}>
      {Array.from({ length }, (_, index) => {
        const filled = Boolean(digits[index]);
        return (
          <input
            key={index}
            ref={(node) => {
              refs.current[index] = node;
            }}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${index + 1}`}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            value={digits[index] ?? ""}
            onFocus={(event) => event.target.select()}
            onChange={(event) => {
              const typed = event.target.value.replace(/\D/g, "");
              if (!typed) return;
              if (typed.length > 1) {
                setDigits(digits.slice(0, index) + typed, index + typed.length);
                return;
              }
              setDigits(digits.slice(0, index) + typed + digits.slice(index + 1), index + 1);
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace") {
                event.preventDefault();
                if (digits[index]) {
                  setDigits(digits.slice(0, index) + digits.slice(index + 1), index);
                } else if (index > 0) {
                  setDigits(digits.slice(0, index - 1) + digits.slice(index), index - 1);
                }
              } else if (event.key === "ArrowLeft" && index > 0) {
                refs.current[index - 1]?.focus();
              } else if (event.key === "ArrowRight" && index < length - 1) {
                refs.current[index + 1]?.focus();
              }
            }}
            onPaste={(event) => {
              event.preventDefault();
              setDigits(event.clipboardData.getData("text"), length - 1);
            }}
            className={`h-13 w-full min-w-0 max-w-14 rounded-xl border-2 text-center text-xl font-semibold text-slate-900 caret-teal-600 outline-none transition-all duration-150 focus:border-teal-500! focus:ring-4 focus:ring-teal-500/15 disabled:opacity-60 sm:h-14 sm:text-2xl ${
              invalid
                ? "border-rose-300! bg-rose-50/60"
                : filled
                  ? "border-teal-400/70! bg-teal-50/50"
                  : "border-slate-200! bg-white hover:border-slate-300!"
            }`}
          />
        );
      })}
    </div>
  );
}
