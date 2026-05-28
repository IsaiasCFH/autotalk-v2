"use client";
// components/layout/Sidebar.tsx — Barra lateral con toggle de tema

import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { DEPARTMENT_META } from "@/types";
import type { Department } from "@prisma/client";

const Icons = {
  inbox: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
    </svg>
  ),
  campaigns: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  ),
  contacts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  numbers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3h3m-3 3h3" />
    </svg>
  ),
  commitments: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  templates: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  agents: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
};

type NavSection = {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  adminOnly?: boolean;
};

const NAV_SECTIONS: NavSection[] = [
  { id: "inbox",       label: "Inbox",       icon: Icons.inbox,       href: "/inbox" },
  { id: "campanias",   label: "Campañas",    icon: Icons.campaigns,   href: "/campanias" },
  { id: "contactos",   label: "Contactos",   icon: Icons.contacts,    href: "/contactos" },
  { id: "numeros",     label: "Números",     icon: Icons.numbers,     href: "/numeros" },
  { id: "compromisos", label: "Compromisos", icon: Icons.commitments, href: "/compromisos" },
  { id: "plantillas",  label: "Plantillas",  icon: Icons.templates,   href: "/plantillas", adminOnly: true },
    { id: "agentes",     label: "Agentes",     icon: Icons.agents,      href: "/agentes", adminOnly: true },
];

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, toggleSidebar, activeDepartment, setActiveDepartment, theme, toggleTheme } = useAppStore();

  const userDepts = (session?.user?.departments ?? []) as Department[];
  const isAdmin = session?.user?.role === "ADMIN";
  const isDark = theme === "dark";

  const activeSection = NAV_SECTIONS.find((s) => pathname.startsWith(s.href))?.id ?? "inbox";
  const visibleSections = NAV_SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  const handleNavClick = (section: NavSection) => router.push(section.href);
  const handleDeptClick = (dept: Department) => {
    setActiveDepartment(dept);
    router.push(`/inbox/${dept.toLowerCase()}`);
  };

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen z-40 flex flex-col",
          "border-r transition-all duration-300 ease-in-out",
          isDark
            ? "bg-[#0d0d1a] border-white/5"
            : "bg-white border-black/8",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Header */}
        <div className={cn("flex items-center justify-between px-4 py-5 border-b", isDark ? "border-white/5" : "border-black/8")}>
          <div className={cn("flex items-center gap-3", !sidebarOpen && "justify-center w-full")}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center flex-shrink-0 text-white">
              {Icons.whatsapp}
            </div>
            {sidebarOpen && (
              <span className={cn("font-semibold text-sm tracking-wide", isDark ? "text-white/90" : "text-black/80")}>
                AutoTalk
              </span>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className={cn("p-1.5 rounded-md transition-colors", isDark ? "text-white/40 hover:text-white/80 hover:bg-white/5" : "text-black/30 hover:text-black/60 hover:bg-black/5")}
            >
              {Icons.chevronLeft}
            </button>
          )}
        </div>

        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className={cn("mx-auto mt-2 p-1.5 rounded-md transition-colors", isDark ? "text-white/40 hover:text-white/80 hover:bg-white/5" : "text-black/30 hover:text-black/60 hover:bg-black/5")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 rotate-180">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}

        {/* Navegación */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleSections.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => handleNavClick(section)}
                title={!sidebarOpen ? section.label : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-emerald-500/15 text-emerald-600 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.2)]"
                    : isDark
                      ? "text-white/50 hover:text-white/80 hover:bg-white/5"
                      : "text-black/50 hover:text-black/80 hover:bg-black/5",
                  !sidebarOpen && "justify-center"
                )}
              >
                <span className="flex-shrink-0">{section.icon}</span>
                {sidebarOpen && <span>{section.label}</span>}
              </button>
            );
          })}

          {/* Departamentos */}
          {sidebarOpen && (
            <div className="pt-4 pb-2">
              <p className={cn("px-3 text-[11px] font-semibold uppercase tracking-widest", isDark ? "text-white/20" : "text-black/25")}>
                Departamentos
              </p>
            </div>
          )}
          {!sidebarOpen && <div className={cn("my-3 border-t", isDark ? "border-white/5" : "border-black/8")} />}

          {(isAdmin ? Object.keys(DEPARTMENT_META) : userDepts).map((dept) => {
            const d = dept as Department;
            const meta = DEPARTMENT_META[d];
            const isActiveDept = activeDepartment === d;
            return (
              <button
                key={d}
                onClick={() => handleDeptClick(d)}
                title={!sidebarOpen ? meta.label : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150",
                  isActiveDept
                    ? cn("border", meta.bgColor, meta.color)
                    : isDark
                      ? "text-white/40 hover:text-white/70 hover:bg-white/5"
                      : "text-black/40 hover:text-black/70 hover:bg-black/5",
                  !sidebarOpen && "justify-center"
                )}
              >
                <span className="text-base flex-shrink-0">{meta.icon}</span>
                {sidebarOpen && <span className="font-medium">{meta.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={cn("border-t p-3", isDark ? "border-white/5" : "border-black/8")}>
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-xs font-bold text-white/80 flex-shrink-0">
                {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium truncate", isDark ? "text-white/80" : "text-black/70")}>
                  {session?.user?.name}
                </p>
                <p className={cn("text-xs truncate", isDark ? "text-white/30" : "text-black/30")}>
                  {session?.user?.role}
                </p>
              </div>
              {/* Toggle tema */}
              <button
                onClick={toggleTheme}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  isDark ? "text-white/30 hover:text-yellow-400 hover:bg-yellow-500/10" : "text-black/30 hover:text-blue-500 hover:bg-blue-500/10"
                )}
                title={isDark ? "Modo claro" : "Modo oscuro"}
              >
                {isDark ? Icons.sun : Icons.moon}
              </button>
              {/* Logout */}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className={cn("p-1.5 rounded-lg transition-colors", isDark ? "text-white/30 hover:text-red-400 hover:bg-red-500/10" : "text-black/30 hover:text-red-500 hover:bg-red-500/10")}
                title="Cerrar sesión"
              >
                {Icons.logout}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              {/* Toggle tema colapsado */}
              <button
                onClick={toggleTheme}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  isDark ? "text-white/30 hover:text-yellow-400 hover:bg-yellow-500/10" : "text-black/30 hover:text-blue-500 hover:bg-blue-500/10"
                )}
                title={isDark ? "Modo claro" : "Modo oscuro"}
              >
                {isDark ? Icons.sun : Icons.moon}
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className={cn("p-2 rounded-lg transition-colors", isDark ? "text-white/30 hover:text-red-400 hover:bg-red-500/10" : "text-black/30 hover:text-red-500 hover:bg-red-500/10")}
                title="Cerrar sesión"
              >
                {Icons.logout}
              </button>
            </div>
          )}
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={toggleSidebar} />
      )}
    </>
  );
}
