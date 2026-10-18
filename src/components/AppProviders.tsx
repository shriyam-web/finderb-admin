"use client";

import type { ReactNode } from "react";
import { AdminToastProvider } from "./AdminToast";
import PwaInstallButton from "./PwaInstallButton";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AdminToastProvider>
      {children}
      <PwaInstallButton />
    </AdminToastProvider>
  );
}
