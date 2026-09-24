"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="light" storageKey="raccoon-theme" enableSystem={false}>
      {children}
      <Toaster richColors closeButton position="top-right" />
    </ThemeProvider>
  );
}
