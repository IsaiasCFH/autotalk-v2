"use client";
// app/providers.tsx — Providers globales + aplicador de tema
//
// Aquí aplicamos la clase "dark" o "light" al <html>
// basándonos en el estado de Zustand.
// Se hace en un Client Component para evitar hydration mismatch.

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

function ThemeApplier() {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [theme]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeApplier />
      {children}
    </SessionProvider>
  );
}
