"use client";
// app/contactos/page.tsx — Gestión de contactos

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { cn, formatPhone, timeAgo } from "@/lib/utils";
import * as XLSX from "xlsx";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Contacto = {
  id: string;
  phone: string;
  name: string | null;
  isBlocked: boolean;
  createdAt: string;
  _count: { conversations: number; commitments: number };
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function ContactosPage() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: number } | null>(null);
  const [newModal, setNewModal] = useState(false);
  const [newForm, setNewForm] = useState({ phone: "", name: "" });
  const [saving, setSaving] = useState(false);

  const fetchContactos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/contactos?${params}`);
      const data = await res.json();
      if (data.ok) {
        setContactos(data.data);
        setTotal(data.total ?? data.data.length);
      }
    } catch {
      toast.error("Error al cargar contactos");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchContactos, 300);
    return () => clearTimeout(timer);
  }, [fetchContactos]);

  // ── Importar Excel ──────────────────────────────────────────────────────────

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
        raw: false,
        defval: "",
      });

      if (rows.length === 0) {
        toast.error("El archivo está vacío");
        return;
      }

      const res = await fetch("/api/contactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const data = await res.json();

      if (data.ok) {
        setImportResult(data.data);
        toast.success(`${data.data.created} contactos importados`);
        fetchContactos();
      }
    } catch {
      toast.error("Error al importar el archivo");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  // ── Crear contacto manual ───────────────────────────────────────────────────

  const handleCreate = async () => {
    const phone = newForm.phone.replace(/\D/g, "");
    if (!phone) return toast.error("El teléfono es requerido");

    setSaving(true);
    try {
      const res = await fetch("/api/contactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name: newForm.name || null }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Contacto creado");
        setNewModal(false);
        setNewForm({ phone: "", name: "" });
        fetchContactos();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Error al crear contacto");
    } finally {
      setSaving(false);
    }
  };

  // ── Exportar a Excel ────────────────────────────────────────────────────────

  const handleExport = () => {
    const data = contactos.map((c) => ({
      nombre: c.name ?? "",
      telefono: c.phone,
      conversaciones: c._count.conversations,
      compromisos: c._count.commitments,
      creado: new Date(c.createdAt).toLocaleDateString("es"),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contactos");
    XLSX.writeFile(wb, `contactos_autotalk_${Date.now()}.xlsx`);
    toast.success("Excel exportado");
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-[#0a0a0f]">

        {/* Header */}
        <div className="px-8 py-6 border-b border-white/5 flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-semibold text-white">Contactos</h1>
                <p className="text-sm text-white/40 mt-1">{total.toLocaleString()} contactos</p>
              </div>
              <div className="flex gap-2">
                {/* Exportar */}
                <button
                  onClick={handleExport}
                  disabled={contactos.length === 0}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 text-white/50 text-sm font-medium hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Exportar
                </button>

                {/* Importar Excel */}
                <label className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors",
                  importing
                    ? "bg-white/5 text-white/30 cursor-not-allowed"
                    : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                )}>
                  {importing ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/50 animate-spin" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  )}
                  Importar Excel
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" disabled={importing} />
                </label>

                {/* Nuevo contacto */}
                <button
                  onClick={() => setNewModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Nuevo
                </button>
              </div>
            </div>

            {/* Resultado de importación */}
            {importResult && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-sm text-emerald-400">
                ✓ {importResult.created} importados · {importResult.skipped} duplicados · {importResult.errors} errores
              </div>
            )}

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

        {/* Tabla */}
        <div className="flex-1 overflow-y-auto px-8 py-4">
          <div className="max-w-5xl mx-auto">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-6 h-6 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
              </div>
            ) : contactos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-8 h-8 text-white/20">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                </div>
                <p className="text-white/30 text-sm mb-4">
                  {search ? "No se encontraron contactos" : "No hay contactos aún"}
                </p>
                {!search && (
                  <label className="px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20 cursor-pointer">
                    Importar Excel
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" />
                  </label>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Header de tabla */}
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-white/30 uppercase tracking-wider">
                  <div className="col-span-4">Nombre</div>
                  <div className="col-span-3">Teléfono</div>
                  <div className="col-span-2 text-center">Conversaciones</div>
                  <div className="col-span-2 text-center">Compromisos</div>
                  <div className="col-span-1 text-right">Creado</div>
                </div>

                {contactos.map((contacto) => (
                  <div
                    key={contacto.id}
                    className="grid grid-cols-12 gap-4 px-4 py-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/4 transition-colors items-center"
                  >
                    {/* Nombre */}
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-xs font-bold text-white/70 flex-shrink-0">
                        {(contacto.name ?? contacto.phone)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {contacto.name ?? <span className="text-white/40 italic">Sin nombre</span>}
                        </p>
                      </div>
                    </div>

                    {/* Teléfono */}
                    <div className="col-span-3">
                      <p className="text-sm text-white/60 font-mono">{formatPhone(contacto.phone)}</p>
                    </div>

                    {/* Conversaciones */}
                    <div className="col-span-2 text-center">
                      <span className={cn(
                        "text-sm font-medium",
                        contacto._count.conversations > 0 ? "text-blue-400" : "text-white/20"
                      )}>
                        {contacto._count.conversations}
                      </span>
                    </div>

                    {/* Compromisos */}
                    <div className="col-span-2 text-center">
                      <span className={cn(
                        "text-sm font-medium",
                        contacto._count.commitments > 0 ? "text-emerald-400" : "text-white/20"
                      )}>
                        {contacto._count.commitments}
                      </span>
                    </div>

                    {/* Fecha */}
                    <div className="col-span-1 text-right">
                      <p className="text-xs text-white/25">{timeAgo(contacto.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal nuevo contacto */}
      {newModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setNewModal(false)} />
          <div
            className="relative w-full max-w-sm bg-[#0d0d1a] border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-white mb-5">Nuevo contacto</h3>

            <div className="space-y-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Teléfono *</label>
                <input
                  type="text"
                  value={newForm.phone}
                  onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="56912345678"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                />
                <p className="text-xs text-white/25">Sin + ni espacios</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Nombre (opcional)</label>
                <input
                  type="text"
                  value={newForm.name}
                  onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Juan Pérez"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setNewModal(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm font-medium hover:bg-white/8 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !newForm.phone}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
