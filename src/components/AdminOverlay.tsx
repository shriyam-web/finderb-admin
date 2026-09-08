"use client";

import { useEffect, useState, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Renders children on document.body so overlays escape admin chrome stacking. */
export function AdminPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}

/** Full-screen overlay above sidebar (z-50) and sticky chrome (z-30). */
export default function AdminOverlay({
  children,
  className = "flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm",
  zClassName = "z-[200]",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  zClassName?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <AdminPortal>
      <div className={`fixed inset-0 ${zClassName} ${className}`} {...rest}>
        {children}
      </div>
    </AdminPortal>
  );
}
