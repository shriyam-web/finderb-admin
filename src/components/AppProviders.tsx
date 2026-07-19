"use client";

import type { ReactNode } from "react";
import { AdminToastProvider } from "./AdminToast";

export default function AppProviders({ children }: { children: ReactNode }) {
  return <AdminToastProvider>{children}</AdminToastProvider>;
}
