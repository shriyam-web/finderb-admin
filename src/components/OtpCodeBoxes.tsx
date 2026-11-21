"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type OtpCodeBoxesProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  autoComplete?: string;
  variant?: "default" | "pin";
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
  autoComplete = "one-time-code",
  variant = "default",
}: OtpCodeBoxesProps) {
  const [masked, setMasked] = useState(true);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const digits = value.replace(/\D/g, "").slice(0, length);
  const empty = digits.length === 0;
  const activeIndex = Math.min(digits.length, length - 1);
  const activeIndexRef = useRef(activeIndex);
  const digitsRef = useRef(digits);
  const onChangeRef = useRef(onChange);
  const onCompleteRef = useRef(onComplete);
  activeIndexRef.current = activeIndex;
  digitsRef.current = digits;
  onChangeRef.current = onChange;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!autoFocus || disabled) return;
    if (variant !== "pin") {
      if (!empty) return;
      refs.current[0]?.focus();
      return;
    }
    const place = () => {
      const node = refs.current[activeIndexRef.current];
      if (!node || document.activeElement === node) return;
      node.focus({ preventScroll: true });
    };
    place();
    const timers = [40, 160, 400, 900].map((wait) => window.setTimeout(place, wait));
    const insideAccount = (node: EventTarget | null) =>
      node instanceof Element && Boolean(node.closest(".admin-panel-lock-person"));
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node && refs.current.some((box) => box === next)) return;
      if (insideAccount(next)) return;
      window.setTimeout(place, 0);
    };
    const onPointer = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && refs.current.some((box) => box === target)) return;
      if (insideAccount(target)) return;
      if (target instanceof Element && target.closest(".admin-panel-lock-reveal")) return;
      refs.current[activeIndexRef.current]?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (refs.current.some((box) => box === document.activeElement)) return;
      if (!/^\d$/.test(event.key)) {
        place();
        return;
      }
      event.preventDefault();
      const index = activeIndexRef.current;
      const current = digitsRef.current;
      const next = (current.slice(0, index) + event.key + current.slice(index + 1)).replace(/\D/g, "").slice(0, length);
      onChangeRef.current(next);
      const focusAt = Math.min(index + 1, length - 1);
      refs.current[focusAt]?.focus();
      if (next.length === length) onCompleteRef.current?.(next);
    };
    const root = groupRef.current;
    root?.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", place);
    window.addEventListener("pageshow", place);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      root?.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", place);
      window.removeEventListener("pageshow", place);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [autoFocus, disabled, empty, variant, length]);

  const setDigits = (next: string, focusIndex: number) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    refs.current[Math.min(focusIndex, length - 1)]?.focus();
    if (clean.length === length) onComplete?.(clean);
  };

  const boxes = (
    <div
      ref={groupRef}
      className={`flex justify-between ${variant === "pin" ? "min-w-0 flex-1 gap-2.5" : "gap-2 sm:gap-3"}`}
      role="group"
      aria-label={`${length}-digit code`}
    >
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
            type={variant === "pin" && masked ? "password" : "text"}
            autoFocus={Boolean(autoFocus && index === activeIndex)}
            autoComplete={index === 0 ? autoComplete : "off"}
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
            className={
              variant === "pin"
                ? `admin-panel-lock-pin h-12 w-full min-w-0 rounded-none border-0 border-b-2 border-solid bg-transparent text-center text-xl font-medium outline-none focus:border-b-slate-900! disabled:opacity-60 ${
                    invalid ? "border-b-rose-400!" : "border-b-slate-300!"
                  }`
                : `h-13 w-full min-w-0 max-w-14 rounded-xl border-2 text-center text-xl font-semibold text-slate-900 caret-teal-600 outline-none transition-all duration-150 focus:border-teal-500! focus:ring-4 focus:ring-teal-500/15 disabled:opacity-60 sm:h-14 sm:text-2xl ${
                    invalid
                      ? "border-rose-300! bg-rose-50/60"
                      : filled
                        ? "border-teal-400/70! bg-teal-50/50"
                        : "border-slate-200! bg-white hover:border-slate-300!"
                  }`
            }
          />
        );
      })}
    </div>
  );

  if (variant !== "pin") return boxes;

  return (
    <div className="admin-panel-lock-pins">
      {boxes}
      <button
        type="button"
        className="admin-panel-lock-reveal"
        aria-label={masked ? "Show PIN" : "Hide PIN"}
        aria-pressed={!masked}
        onClick={() => {
          setMasked((hidden) => !hidden);
          refs.current[activeIndexRef.current]?.focus({ preventScroll: true });
        }}
      >
        {masked ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
      </button>
    </div>
  );
}
