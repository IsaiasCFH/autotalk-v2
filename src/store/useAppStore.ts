"use client";
// store/useAppStore.ts — Estado global de UI con Zustand

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Department } from "@prisma/client";

type Section =
  | "inbox"
  | "campanias"
  | "contactos"
  | "numeros"
  | "compromisos"
  | "agentes"
  | "configuracion";

type Theme = "dark" | "light";

type AppState = {
  // ── Sidebar ─────────────────────────────
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // ── Departamento activo ──────────────────
  activeDepartment: Department | null;
  setActiveDepartment: (dept: Department | null) => void;

  // ── Sección activa ───────────────────────
  activeSection: Section;
  setActiveSection: (section: Section) => void;

  // ── Conversación abierta ─────────────────
  openConversationId: string | null;
  setOpenConversationId: (id: string | null) => void;

  // ── Notificaciones ───────────────────────
  unreadCount: number;
  setUnreadCount: (count: number) => void;

  // ── Tema ─────────────────────────────────
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      activeDepartment: null,
      setActiveDepartment: (dept) => set({ activeDepartment: dept }),

      activeSection: "inbox",
      setActiveSection: (section) => set({ activeSection: section }),

      openConversationId: null,
      setOpenConversationId: (id) => set({ openConversationId: id }),

      unreadCount: 0,
      setUnreadCount: (count) => set({ unreadCount: count }),

      theme: "dark",
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "autotalk-ui",
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        activeDepartment: state.activeDepartment,
        activeSection: state.activeSection,
        theme: state.theme,
      }),
    }
  )
);
