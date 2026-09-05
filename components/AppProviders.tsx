"use client";

import type { ReactNode } from "react";
import { AppStoreProvider } from "@/components/AppStoreProvider";
import { ToastProvider } from "@/components/ToastProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AppStoreProvider>{children}</AppStoreProvider>
    </ToastProvider>
  );
}
