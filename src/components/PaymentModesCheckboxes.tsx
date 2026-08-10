"use client";

import {
  PAYMENT_MODE_OPTIONS,
  togglePaymentMode,
} from "../lib/paymentModes";

type Props = {
  values: string[];
  onChange: (next: string[]) => void;
  /** Optional id prefix for checkbox inputs. */
  idPrefix?: string;
  className?: string;
};

/** Checkbox grid for selecting merchant payment modes. */
export default function PaymentModesCheckboxes({
  values,
  onChange,
  idPrefix = "payment-mode",
  className = "",
}: Props) {
  const selected = values ?? [];
  const options = [
    ...PAYMENT_MODE_OPTIONS,
    ...selected.filter((v) => !(PAYMENT_MODE_OPTIONS as readonly string[]).includes(v)),
  ];

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Payment modes</p>
        <p className="text-[11px] text-slate-500">Optional — edit anytime later</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2">
        {options.map((mode) => {
          const id = `${idPrefix}-${mode.replace(/\s+/g, "-").toLowerCase()}`;
          return (
            <label
              key={mode}
              htmlFor={id}
              className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer"
            >
              <input
                id={id}
                type="checkbox"
                checked={selected.includes(mode)}
                onChange={() => onChange(togglePaymentMode(selected, mode))}
                className="h-3.5 w-3.5 rounded border-slate-300 accent-teal-700"
              />
              {mode}
            </label>
          );
        })}
      </div>
    </div>
  );
}
