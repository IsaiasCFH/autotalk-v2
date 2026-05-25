"use client";
// app/agentes/page.tsx — Gestión de agentes
// Solo accesible para ADMIN

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEPARTMENT_META } from "@/types";
import type { Department, Role } from "@prisma/client";

type Agente = {
  id: string;
  name: string;
  email: string;
  role: Role;
  departments: Department[];
  isActive: boolean;
  createdAt: string;
};

const ROLE_META: Record<Role, { label: string; color: string; bg: string }> = {
  ADMIN: { label: "Admin", color: "text-purple-400", bg: "bg-purple-500/10 border border-purple-500/20" },
  AGENT: { label: "Agente", color: "text-blue-400",   bg: "bg-blue-500/10 border border-blue-500/20" },
};

const DEPT_OPTIONS = Object.entries(DEPARTMENT_META).map(([value, meta]) => ({
  value: value as Department,
  label: meta.label,
  icon: meta.icon,
}));

export default function AgentesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<Agente | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "AGENT" as Role,
    departments: [] as Department[],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (session && session.user.role !== "ADMIN") router.replace("/inbox");
  }, [session, router]);

  const fetchAgentes = useCallback(async () => {
    try {
      const res = await fetch("/api/agentes");
      const data = await res.json();
      if (data.ok) setAgentes(data.data);
    } catch {
      toast.error("Error al cargar agentes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgentes(); }, [fetchAgentes]);

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) return toast.error("Nombre, email y contraseña son requeridos");
    if (form.role === "AGENT" && form.departments.length === 0) return toast.error("Selecciona al menos un departamento");
    setSaving(true);
    try {
      const res = await fetch("/api/agentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) { toast.success("Agente creado"); setModal(null); resetForm(); fetchAgentes(); }
      else toast.error(data.error);
    } catch { toast.error("Error al crear agente"); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { name: form.name, role: form.role, departments: form.departments };
      if (form.password) body.password = form.password;
      const res = await fetch(`/api/agentes/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) { toast.success("Agente actualizado"); setModal(null); setSelected(null); resetForm(); fetchAgentes(); }
      else toast.error(data.error);
    } catch { toast.error("Error al actualizar agente"); }
    finally { setSaving(false); }
  };

  const handleToggle = async (agente: Agente) => {
    try {
      const res = await fetch(`/api/agentes/${agente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !agente.isActive }),
      });
      const data = await res.json();
      if (data.ok) { toast.success(agente.isActive ? "Agente desactivado" : "Agente activado"); fetchAgentes(); }
      else toast.error(data.error);
    } catch { toast.error("Error al actualizar agente"); }
  };

  const openEdit = (agente: Agente) => {
    setSelected(agente);
    setForm({ name: agente.name, email: agente.email, password: "", role: agente.role, departments: agente.departments });
    setModal("edit");
  };

  const openCreate = () => { resetForm(); setSelected(null); setModal("create"); };
  const resetForm = () => setForm({ name: "", email: "", password: "", role: "AGENT", departments: [] });
  const toggleDept = (dept: Department) => setForm((f) => ({
    ...f,
    departments: f.departments.includes(dept) ? f.departments.filter((d) => d !== dept) : [...f.departments, dept],
  }));

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-8 bg-[#0a0a0f]">
        <div className="max-w-4xl mx-auto">

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl font-semibold text-white">Agentes</h1>
              <p className="text-sm text-white/40 mt-1">
                {agentes.filter((a) => a.isActive).length} activos · {agentes.length} total
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nuevo agente
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-6 h-6 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {agentes.map((agente) => {
                const role = ROLE_META[agente.role];
                const isMe = agente.id === session?.user?.id;

                return (
                  <div
                    key={agente.id}
                    className={cn(
                      "flex items-center gap-4 p-5 rounded-2xl border transition-all",
                      agente.isActive ? "bg-white/[0.02] border-white/8" : "bg-white/[0.01] border-white/5 opacity-50"
                    )}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-sm font-bold text-white/70 flex-shrink-0">
                      {agente.name[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <p className="text-sm font-medium text-white">{agente.name}</p>
                        {isMe && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40">tú</span>
                        )}
                        {/* Badge de rol */}
                        <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", role.bg, role.color)}>
                          {role.label}
                        </span>
                        {/* Badge de departamento(s) con color propio */}
                        {agente.departments.map((dept) => {
                          const meta = DEPARTMENT_META[dept];
                          return (
                            <span
                              key={dept}
                              className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium border", meta.bgColor, meta.color)}
                            >
                              {meta.icon} {meta.label}
                            </span>
                          );
                        })}
                        {!agente.isActive && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40">{agente.email}</p>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openEdit(agente)}
                        className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                        title="Editar"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      {!isMe && (
                        <button
                          onClick={() => handleToggle(agente)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg transition-colors text-xs font-medium",
                            agente.isActive
                              ? "text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
                              : "text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/10"
                          )}
                        >
                          {agente.isActive ? "Desactivar" : "Activar"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div
            className="relative w-full max-w-md bg-[#0d0d1a] border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-white mb-5">
              {modal === "create" ? "Nuevo agente" : "Editar agente"}
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Juan Pérez"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              {modal === "create" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="juan@empresa.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  Contraseña {modal === "edit" && <span className="text-white/20 normal-case font-normal">(vacío = no cambiar)</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Rol</label>
                <div className="flex gap-2">
                  {(["ADMIN", "AGENT"] as Role[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setForm((f) => ({ ...f, role: r }))}
                      className={cn(
                        "flex-1 py-2 rounded-xl border text-sm font-medium transition-all",
                        form.role === r
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-white/3 border-white/8 text-white/40 hover:bg-white/5"
                      )}
                    >
                      {ROLE_META[r].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  Departamentos{" "}
                  {form.role === "ADMIN" && <span className="text-white/20 normal-case font-normal">(Admin accede a todo)</span>}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DEPT_OPTIONS.map((d) => {
                    const meta = DEPARTMENT_META[d.value];
                    const selected = form.departments.includes(d.value) || form.role === "ADMIN";
                    return (
                      <button
                        key={d.value}
                        onClick={() => toggleDept(d.value)}
                        disabled={form.role === "ADMIN"}
                        className={cn(
                          "flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs transition-all",
                          selected
                            ? cn("border", meta.bgColor, meta.color)
                            : "bg-white/3 border-white/8 text-white/40 hover:bg-white/5",
                          form.role === "ADMIN" && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <span className="text-lg">{d.icon}</span>
                        <span>{d.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm font-medium hover:bg-white/8 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={modal === "create" ? handleCreate : handleEdit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20 disabled:opacity-50"
              >
                {saving ? "Guardando..." : modal === "create" ? "Crear agente" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
