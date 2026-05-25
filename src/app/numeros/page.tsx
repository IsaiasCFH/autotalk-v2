"use client";
// app/numeros/page.tsx — Gestión de números WhatsApp
//
// FLUJO DE CONEXIÓN:
// 1. Clic en "Conectar QR" → crea instancia en Evolution si no existe
// 2. Abre el manager de Evolution en nueva pestaña
// 3. Usuario escanea el QR ahí
// 4. Polling cada 3 segundos detecta cuando se conectó
// 5. Toast de éxito + actualiza la lista

import { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { cn, formatPhone } from "@/lib/utils";
import { DEPARTMENT_META } from "@/types";
import type { Department } from "@prisma/client";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type WhatsappNumber = {
  id: string;
  number: string;
  label: string | null;
  department: Department;
  status: "CONNECTED" | "DISCONNECTED" | "BANNED";
  _count: { conversations: number; campaigns: number };
  evolutionData: { profileName?: string } | null;
};

const DEPT_OPTIONS = Object.entries(DEPARTMENT_META).map(([value, meta]) => ({
  value: value as Department,
  label: meta.label,
  icon: meta.icon,
}));

// ── Componente principal ──────────────────────────────────────────────────────

export default function NumerosPage() {
  const [numbers, setNumbers] = useState<WhatsappNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModal, setNewModal] = useState(false);
  const [newForm, setNewForm] = useState({ number: "", label: "", department: "COBRANZA" as Department });
  const [newLoading, setNewLoading] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // Referencia al intervalo de polling
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNumbers = useCallback(async () => {
    try {
      const res = await fetch("/api/numeros");
      const data = await res.json();
      if (data.ok) setNumbers(data.data);
    } catch {
      toast.error("Error al cargar números");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNumbers();
  }, [fetchNumbers]);

  // Limpiar polling al desmontar
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ── Conectar número via manager de Evolution ──────────────────────────────

  const handleConnect = async (num: WhatsappNumber) => {
    setConnectingId(num.id);

    // Crear instancia en Evolution si no existe
    try {
      await fetch(`/api/numeros/${num.id}/connect`, { method: "POST" });
    } catch {
      // Si falla es porque ya existe — no importa
    } finally {
      setConnectingId(null);
    }

    // Abrir el manager de Evolution en nueva pestaña
    // El usuario escanea el QR ahí directamente
    window.open(
      `${process.env.NEXT_PUBLIC_EVOLUTION_URL ?? "http://localhost:8080"}/manager`,
      "_blank"
    );

    // Iniciar polling para detectar la conexión automáticamente
    startPolling(num.id);

    toast.info("Escanea el QR en el manager de Evolution que se abrió", {
      duration: 8000,
    });
  };

  // Polling — verifica cada 3 segundos si el número se conectó
  const startPolling = (numberId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/numeros/${numberId}/connect`);
        const data = await res.json();

        if (data.data?.isConnected) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          toast.success(
            `¡Número conectado!${data.data.profileName ? ` (${data.data.profileName})` : ""}`
          );
          fetchNumbers();
        }
      } catch {
        // Silenciar errores de polling
      }
    }, 3000);
  };

  // ── Crear nuevo número ──────────────────────────────────────────────────────

  const handleCreateNumber = async () => {
    if (!newForm.number || !newForm.department) return;
    setNewLoading(true);
    try {
      const res = await fetch("/api/numeros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Número registrado");
        setNewModal(false);
        setNewForm({ number: "", label: "", department: "COBRANZA" });
        fetchNumbers();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Error al crear número");
    } finally {
      setNewLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const connected = numbers.filter((n) => n.status === "CONNECTED");

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-8 bg-[#0a0a0f]">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl font-semibold text-white">Números WhatsApp</h1>
              <p className="text-sm text-white/40 mt-1">
                {connected.length} conectado{connected.length !== 1 ? "s" : ""} · {numbers.length} total
              </p>
            </div>
            <div className="flex gap-2">
              {/* Botón refrescar */}
              <button
                onClick={fetchNumbers}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 text-white/50 text-sm font-medium hover:bg-white/10 hover:text-white transition-colors"
                title="Refrescar estados"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
              <button
                onClick={() => setNewModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Agregar número
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-6 h-6 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
            </div>
          ) : numbers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-8 h-8 text-white/20">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3" />
                </svg>
              </div>
              <p className="text-white/30 text-sm mb-4">No hay números registrados aún</p>
              <button
                onClick={() => setNewModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20"
              >
                Agregar primer número
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {numbers.map((num) => {
                const dept = DEPARTMENT_META[num.department];
                const isConnected = num.status === "CONNECTED";

                return (
                  <div
                    key={num.id}
                    className={cn(
                      "flex items-center gap-4 p-5 rounded-2xl border transition-all",
                      isConnected
                        ? "bg-emerald-500/5 border-emerald-500/15"
                        : "bg-white/[0.02] border-white/8"
                    )}
                  >
                    {/* Avatar con estado */}
                    <div className="relative flex-shrink-0">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center",
                        isConnected ? "bg-emerald-500/15" : "bg-white/5"
                      )}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className={cn("w-6 h-6", isConnected ? "text-emerald-400" : "text-white/30")}>
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </div>
                      <span className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0a0a0f]",
                        isConnected ? "bg-emerald-400" : "bg-slate-600"
                      )} />
                    </div>

                    {/* Info del número */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-white">
                          {num.label ?? formatPhone(num.number)}
                        </p>
                        {isConnected && num.evolutionData?.profileName && (
                          <span className="text-xs text-emerald-400/70">
                            · {num.evolutionData.profileName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40">
                        {dept.icon} {dept.label}
                        {num.label && ` · ${formatPhone(num.number)}`}
                        {" · "}{num._count.conversations} conversaciones
                        {" · "}{num._count.campaigns} campañas
                      </p>
                    </div>

                    {/* Badge + botón */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={cn(
                        "text-xs font-medium px-2.5 py-1 rounded-full",
                        isConnected
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-white/5 text-white/40"
                      )}>
                        {isConnected ? "Conectado" : "Desconectado"}
                      </span>

                      {!isConnected && (
                        <button
                          onClick={() => handleConnect(num)}
                          disabled={connectingId === num.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs font-medium hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
                        >
                          {connectingId === num.id ? (
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                            </svg>
                          )}
                          Conectar QR
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

      {/* ── Modal nuevo número ─────────────────────────────────────────────── */}
      {newModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setNewModal(false)} />
          <div
            className="relative w-full max-w-sm bg-[#0d0d1a] border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-white mb-5">Agregar número</h3>

            <div className="space-y-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  Número WhatsApp
                </label>
                <input
                  type="text"
                  value={newForm.number}
                  onChange={(e) => setNewForm((f) => ({ ...f, number: e.target.value.replace(/\D/g, "") }))}
                  placeholder="56912345678"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                />
                <p className="text-xs text-white/25">Sin + ni espacios. Ej: 56912345678</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  Nombre / etiqueta
                </label>
                <input
                  type="text"
                  value={newForm.label}
                  onChange={(e) => setNewForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Ej: Cobranza Principal"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  Departamento
                </label>
                <select
                  value={newForm.department}
                  onChange={(e) => setNewForm((f) => ({ ...f, department: e.target.value as Department }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                >
                  {DEPT_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value} className="bg-[#0d0d1a]">
                      {d.icon} {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setNewModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm font-medium hover:bg-white/8 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateNumber}
                disabled={newLoading || !newForm.number}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20 disabled:opacity-50"
              >
                {newLoading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}