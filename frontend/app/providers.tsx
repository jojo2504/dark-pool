"use client";
import { CantonProvider } from "@/lib/canton-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <CantonProvider>{children}</CantonProvider>;
}
