"use client";
// app/compromisos/page.tsx — Gestión de compromisos de pago

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { cn, formatPhone, timeAgo } from "@/lib/utils";
import type { CommitmentStatus } from "@prisma/client";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Compromiso = {
  id: string;
  status: CommitmentStatus;
  amount: number | null;
  dueDate: string | null;
  notes: string | null;
  rawResponse: string | null;
  autoDetected: boolean;
  createdAt: string;
  contact: { id: string; name: string | null; phone: string };
};

// ── Metadata de estados ───────────────────────────────────────────────────────

const STATUS_META: Record<CommitmentStatus, { label: string; color: string; bg: string; icon: string }> = {
  PENDING:  { label: "Pendiente",    color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/20",  icon: "⏳" },
  PAID:     { label: "Pagó",         color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: "✅" },
  BROKEN:   { label: "Incumplió",    color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",         icon: "❌" },
  CHURNED:  { label: "Sin servicio", color: "text-slate-400",   bg: "bg-slate-500/10 border-slate-500/20",     icon: "🚫" },
};

const STATUS_FILTERS: { value: CommitmentStatus | "ALL"; label: string }[] = [
  { value: "ALL",     label: "Todos" },
  { value: "PENDING", label: "Pendientes" },
  { value: "PAID",    label: "Pagaron" },
  { value: "BROKEN",  label: "Incumplieron" },
  { value: "CHURNED", label: "Sin servicio" },
];

// ── Componente principal ──────────────────────────────────────────────────────

export default function CompromisosPage() {
  const [compromisos, setCompromisos] = useState<Compromiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<CommitmentStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [editModal, setEditModal] = useState<Compromiso | null>(null);
  const [editForm, setEditForm] = useState({ status: "" as CommitmentStatus, dueDate: "", notes: "", amount: "" });
  const [saving, setSaving] = useState(false);

  const fetchCompromisos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/compromisos?${params}`);
      const data = await res.json();
      if (data.ok) setCompromisos(data.data);
    } catch {
      toast.error("Error al cargar compromisos");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    const timer = setTimeout(fetchCompromisos, 300);
    return () => clearTimeout(timer);
  }, [fetchCompromisos]);

  // ── Editar compromiso ───────────────────────────────────────────────────────

  const openEdit = (c: Compromiso) => {
    setEditModal(c);
    setEditForm({
      status: c.status,
      dueDate: c.dueDate ? c.dueDate.split("T")[0] : "",
      notes: c.notes ?? "",
      amount: c.amount ? String(c.amount) : "",
    });
  };

  const handleEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/compromisos/${editModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editForm.status,
          dueDate: editForm.dueDate || null,
          notes: editForm.notes || null,
          amount: editForm.amount || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Compromiso actualizado");
        setEditModal(null);
        fetchCompromisos();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = {
    total: compromisos.length,
    pending: compromisos.filter((c) => c.status === "PENDING").length,
    paid: compromisos.filter((c) => c.status === "PAID").length,
    broken: compromisos.filter((c) => c.status === "BROKEN").length,
    churned: compromisos.filter((c) => c.status === "CHURNED").length,
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-[#0a0a0f]">

        {/* Header */}
        <div className="px-8 py-6 border-b border-white/5 flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-semibold text-white">Compromisos de pago</h1>
                <p className="text-sm text-white/40 mt-1">
                  Detectados automáticamente por IA · {stats.total} total
                </p>
              </div>
              {/* Indicador de IA */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                <span className="text-sm">🤖</span>
                <span className="text-xs text-emerald-400">OpenAI activo</span>
              </div>
            </div>

            {/* Stats rápidas */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: "Pendientes", value: stats.pending, color: "text-yellow-400", icon: "⏳" },
                { label: "Pagaron", value: stats.paid, color: "text-emerald-400", icon: "✅" },
                { label: "Incumplieron", value: stats.broken, color: "text-red-400", icon: "❌" },
                { label: "Sin servicio", value: stats.churned, color: "text-slate-400", icon: "🚫" },
              ].map(({ label, value, color, icon }) => (
                <div key={label} className="bg-white/[0.02] border border-white/8 rounded-xl p-4">
                  <p className="text-xs text-white/40 mb-1">{icon} {label}</p>
                  <p className={cn("text-2xl font-bold", color)}>{value}</p>
                </div>
              ))}
            </div>

            {/* Filtros de estado */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    statusFilter === f.value
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                      : "bg-white/5 text-white/40 hover:bg-white/8 hover:text-white/60"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Búsqueda */}
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 text-white/30 absolute left-4 top-1/2 -translate-y-1/2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o teléfono..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/30 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-8 py-4">
          <div className="max-w-5xl mx-auto">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-6 h-6 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
              </div>
            ) : compromisos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-4xl mb-4">📋</div>
                <p className="text-white/30 text-sm">
                  {search || statusFilter !== "ALL"
                    ? "No hay compromisos con esos filtros"
                    : "No hay compromisos registrados aún"}
                </p>
                <p className="text-white/20 text-xs mt-2">
                  Se registran automáticamente cuando los clientes responden a campañas de cobranza
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {compromisos.map((c) => {
                  const status = STATUS_META[c.status];
                  const nombre = c.contact.name ?? formatPhone(c.contact.phone);
                  const isOverdue = c.status === "PENDING" && c.dueDate && new Date(c.dueDate) < new Date();

                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "flex items-start gap-4 p-5 rounded-2xl border transition-all",
                        isOverdue
                          ? "bg-red-500/5 border-red-500/15"
                          : "bg-white/[0.02] border-white/8 hover:bg-white/3"
                      )}
                    >
                      {/* Estado */}
                      <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium flex-shrink-0 mt-0.5", status.bg, status.color)}>
                        <span>{status.icon}</span>
                        <span>{status.label}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-white">{nombre}</p>
                          <p className="text-xs text-white/30">{formatPhone(c.contact.phone)}</p>
                          {c.autoDetected && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                              🤖 IA
                            </span>
                          )}
                          {isOverdue && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/15">
                              Vencido
                            </span>
                          )}
                        </div>

                        {/* Fecha compromiso */}
                        {c.dueDate && (
                          <p className="text-xs text-white/50 mb-1">
                            📅 Prometió pagar el{" "}
                            <span className={cn("font-medium", isOverdue ? "text-red-400" : "text-white/70")}>
                              {new Date(c.dueDate).toLocaleDateString("es", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                              })}
                            </span>
                          </p>
                        )}

                        {/* Monto */}
                        {c.amount && (
                          <p className="text-xs text-white/50 mb-1">
                            💰 Monto: <span className="text-white/70 font-medium">${c.amount.toLocaleString()}</span>
                          </p>
                        )}

                        {/* Respuesta original */}
                        {c.rawResponse && (
                          <p className="text-xs text-white/30 italic mt-1 truncate">
                            "{c.rawResponse}"
                          </p>
                        )}

                        {/* Notas */}
                        {c.notes && (
                          <p className="text-xs text-white/40 mt-1">{c.notes}</p>
                        )}

                        <p className="text-[10px] text-white/20 mt-1.5">{timeAgo(c.createdAt)}</p>
                      </div>

                      {/* Botón editar */}
                      <button
                        onClick={() => openEdit(c)}
                        className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors flex-shrink-0"
                        title="Editar compromiso"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal editar compromiso */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditModal(null)} />
          <div
            className="relative w-full max-w-sm bg-[#0d0d1a] border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-white mb-1">Editar compromiso</h3>
            <p className="text-xs text-white/40 mb-5">
              {editModal.contact.name ?? formatPhone(editModal.contact.phone)}
            </p>

            <div className="space-y-4">
              {/* Estado */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Estado</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(STATUS_META) as CommitmentStatus[]).map((s) => {
                    const meta = STATUS_META[s];
                    return (
                      <button
                        key={s}
                        onClick={() => setEditForm((f) => ({ ...f, status: s }))}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all",
                          editForm.status === s
                            ? cn(meta.bg, meta.color)
                            : "bg-white/3 border-white/8 text-white/40 hover:bg-white/5"
                        )}
                      >
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fecha */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Fecha compromiso</label>
                <input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              {/* Monto */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Monto (opcional)</label>
                <input
                  type="number"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="50000"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              {/* Notas */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Notas</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Observaciones del agente..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm font-medium hover:bg-white/8 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEdit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
