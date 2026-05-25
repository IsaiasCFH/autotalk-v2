"use client";
// app/campanias/page.tsx — Módulo de campañas masivas
//
// Panel izquierdo → lista de campañas con barra de progreso
// Panel derecho   → detalle + métricas + controles (iniciar/pausar/reanudar)

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CreateCampaignModal } from "@/components/campaigns/CreateCampaignModal";
import { toast } from "sonner";
import { cn, timeAgo } from "@/lib/utils";
import { DEPARTMENT_META } from "@/types";
import type { Department, CampaignStatus } from "@prisma/client";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type CampaignStats = {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};

type Campaign = {
  id: string;
  name: string;
  department: Department;
  status: CampaignStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  agent: { name: string };
  number: { number: string; label: string | null };
  stats: CampaignStats;
};

const STATUS_META: Record<CampaignStatus, { label: string; color: string; bg: string; dot: string }> = {
  DRAFT:     { label: "Borrador",   color: "text-slate-400",   bg: "bg-slate-500/10",   dot: "bg-slate-400" },
  RUNNING:   { label: "Enviando",   color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-400" },
  PAUSED:    { label: "Pausada",    color: "text-yellow-400",  bg: "bg-yellow-500/10",  dot: "bg-yellow-400" },
  COMPLETED: { label: "Completada", color: "text-blue-400",    bg: "bg-blue-500/10",    dot: "bg-blue-400" },
  FAILED:    { label: "Fallida",    color: "text-red-400",     bg: "bg-red-500/10",     dot: "bg-red-400" },
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function CampaniasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/campanias");
      const data = await res.json();
      if (data.ok) setCampaigns(data.data);
    } catch {
      toast.error("Error al cargar campañas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 10000);
    return () => clearInterval(interval);
  }, [fetchCampaigns]);

  const handleAction = async (campaignId: string, action: "start" | "pause" | "resume") => {
    setActionLoading(campaignId);
    try {
      const res = await fetch(`/api/campanias/${campaignId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message);
        fetchCampaigns();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Error al ejecutar acción");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full">

        {/* Panel izquierdo */}
        <div className="w-96 border-r border-white/5 flex flex-col bg-[#0d0d1a]">
          <div className="px-5 py-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-base font-semibold text-white">Campañas</h1>
                <p className="text-xs text-white/30 mt-0.5">{campaigns.length} campañas</p>
              </div>
              <button
                onClick={() => setCreateModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nueva
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-8">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6 text-white/30">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </div>
                <p className="text-sm text-white/30 mb-3">No hay campañas aún</p>
                <button
                  onClick={() => setCreateModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20"
                >
                  Crear primera campaña
                </button>
              </div>
            ) : (
              campaigns.map((campaign) => {
                const status = STATUS_META[campaign.status];
                const dept = DEPARTMENT_META[campaign.department];
                const isSelected = selected?.id === campaign.id;
                const pct = campaign.stats.total > 0
                  ? Math.round(((campaign.stats.sent + campaign.stats.delivered + campaign.stats.read) / campaign.stats.total) * 100)
                  : 0;

                return (
                  <button
                    key={campaign.id}
                    onClick={() => setSelected(campaign)}
                    className={cn(
                      "w-full text-left px-5 py-4 border-b border-white/5 hover:bg-white/3 transition-colors",
                      isSelected && "bg-white/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{campaign.name}</p>
                        <p className="text-xs text-white/30 mt-0.5">{dept.icon} {dept.label} · {timeAgo(campaign.createdAt)}</p>
                      </div>
                      <span className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium flex-shrink-0", status.bg, status.color)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", status.dot, campaign.status === "RUNNING" && "animate-pulse")} />
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-white/30 mb-1">
                        <span>{campaign.stats.sent + campaign.stats.delivered + campaign.stats.read} enviados</span>
                        <span>{campaign.stats.total} total</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Panel derecho */}
        <div className="flex-1 overflow-y-auto bg-[#0a0a0f]">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-8 h-8 text-white/20">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </div>
              <p className="text-white/30 text-sm">Selecciona una campaña para ver sus métricas</p>
            </div>
          ) : (
            <div className="p-8 max-w-3xl">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h2 className="text-xl font-semibold text-white">{selected.name}</h2>
                  <p className="text-sm text-white/40 mt-1">
                    {DEPARTMENT_META[selected.department].icon} {DEPARTMENT_META[selected.department].label}
                    {" · "} Número: {selected.number.label ?? selected.number.number}
                    {" · "} Creado por {selected.agent.name}
                  </p>
                </div>
                <div className="flex gap-2">
                  {selected.status === "DRAFT" && (
                    <button
                      onClick={() => handleAction(selected.id, "start")}
                      disabled={actionLoading === selected.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20 disabled:opacity-50"
                    >
                      {actionLoading === selected.id ? (
                        <span className="w-4 h-4 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8 5.14v14l11-7-11-7z" /></svg>
                      )}
                      Iniciar campaña
                    </button>
                  )}
                  {selected.status === "RUNNING" && (
                    <button
                      onClick={() => handleAction(selected.id, "pause")}
                      disabled={actionLoading === selected.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/15 text-yellow-400 text-sm font-medium hover:bg-yellow-500/25 transition-colors border border-yellow-500/20 disabled:opacity-50"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                      Pausar
                    </button>
                  )}
                  {selected.status === "PAUSED" && (
                    <button
                      onClick={() => handleAction(selected.id, "resume")}
                      disabled={actionLoading === selected.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20 disabled:opacity-50"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8 5.14v14l11-7-11-7z" /></svg>
                      Reanudar
                    </button>
                  )}
                </div>
              </div>

              {/* Métricas */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {[
                  { label: "Total contactos", value: selected.stats.total, color: "text-white" },
                  { label: "Enviados", value: selected.stats.sent, color: "text-blue-400" },
                  { label: "Entregados", value: selected.stats.delivered, color: "text-teal-400" },
                  { label: "Leídos ✓✓", value: selected.stats.read, color: "text-emerald-400" },
                  { label: "Fallidos", value: selected.stats.failed, color: "text-red-400" },
                  { label: "Pendientes", value: selected.stats.pending, color: "text-slate-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white/[0.03] border border-white/8 rounded-xl p-4">
                    <p className="text-xs text-white/40 mb-1">{label}</p>
                    <p className={cn("text-2xl font-bold", color)}>{value.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Barras de progreso */}
              {selected.stats.total > 0 && (
                <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 mb-6">
                  <h3 className="text-sm font-medium text-white/60 mb-4">Progreso de entrega</h3>
                  {[
                    { label: "Tasa de envío", value: selected.stats.sent + selected.stats.delivered + selected.stats.read, color: "bg-blue-500" },
                    { label: "Tasa de entrega", value: selected.stats.delivered + selected.stats.read, color: "bg-teal-500" },
                    { label: "Tasa de lectura", value: selected.stats.read, color: "bg-emerald-500" },
                  ].map(({ label, value, color }) => {
                    const pct = Math.round((value / selected.stats.total) * 100);
                    return (
                      <div key={label} className="mb-4 last:mb-0">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-white/50">{label}</span>
                          <span className="text-white/80 font-medium">{pct}% <span className="text-white/30">({value})</span></span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Info anti-spam */}
              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <span className="text-lg">🤖</span>
                  <div>
                    <p className="text-sm font-medium text-emerald-400">Modo anti-spam activo</p>
                    <p className="text-xs text-white/40 mt-1">
                      Cada mensaje se envía con delay de typing (1–10s) + pausa aleatoria (3–8s) entre contactos.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal crear campaña */}
      <CreateCampaignModal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        onCreated={fetchCampaigns}
      />
    </AppLayout>
  );
}
