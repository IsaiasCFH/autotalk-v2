"use client";
// components/layout/AppLayout.tsx — Layout para páginas autenticadas
//
// Todas las páginas protegidas (inbox, campañas, etc.) usan este layout.
// Contiene el sidebar + el área de contenido principal.
//
// Patrón: layout de app estilo "panel lateral" clásico.
// El sidebar tiene ancho fijo, el main ocupa el resto con overflow-auto.

import { useAppStore } from "@/store/useAppStore";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen } = useAppStore();

  return (
    <div className="flex h-screen bg-[#0a0a0f] overflow-hidden">
      <Sidebar />

      {/* Área principal — se desplaza para dejar espacio al sidebar */}
      <main
        className={cn(
          "flex-1 flex flex-col min-h-screen overflow-hidden",
          "transition-all duration-300 ease-in-out",
          sidebarOpen ? "ml-64" : "ml-16"
        )}
      >
        {children}
      </main>
    </div>
  );
}
