"use client";
import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEPARTMENT_META } from "@/types";
import type { Department } from "@prisma/client";

type Template = {
  id: string;
  name: string;
  content: string;
  department: Department;
  createdAt: string;
};

const DEPT_OPTIONS = Object.entries(DEPARTMENT_META).map(([value, meta]) => ({
  value: value as Department,
  label: meta.label,
  icon: meta.icon,
}));

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, ""))));
}

export default function PlantillasPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department>("COBRANZA");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/plantillas?department=${selectedDept}`);
      const data = await res.json();
      if (data.ok) setTemplates(data.data);
    } catch {}
    finally { setLoading(false); }
  }, [selectedDept]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleCreate = async () => {
    if (!newName.trim() || !newContent.trim()) return toast.error("Completa nombre y contenido");
    setSaving(true);
    try {
      const res = await fetch("/api/plantillas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, content: newContent, department: selectedDept }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Plantilla creada");
        setNewName(""); setNewContent(""); setShowNew(false);
        fetchTemplates();
      }
    } catch { toast.error("Error al crear"); }
    finally { setSaving(false); }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim() || !editContent.trim()) return toast.error("Completa nombre y contenido");
    setSaving(true);
    try {
      const res = await fetch(`/api/plantillas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, content: editContent }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Plantilla actualizada");
        setEditingId(null);
        fetchTemplates();
      } else toast.error(data.error ?? "Error al actualizar");
    } catch { toast.error("Error al actualizar"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    try {
      const res = await fetch(`/api/plantillas/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) { toast.success("Plantilla eliminada"); fetchTemplates(); }
      else toast.error(data.error ?? "Error al eliminar");
    } catch { toast.error("Error al eliminar"); }
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Plantillas</h1>
            <p className="text-sm text-white/40 mt-1">Gestiona las plantillas de mensajes por departamento</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20"
          >
            + Nueva plantilla
          </button>
        </div>

        {/* Selector departamento */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {DEPT_OPTIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => setSelectedDept(d.value)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm transition-all",
                selectedDept === d.value
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-white/3 border-white/8 text-white/40 hover:bg-white/5"
              )}
            >
              <span>{d.icon}</span>
              <span>{d.label}</span>
            </button>
          ))}
        </div>

        {/* Nueva plantilla */}
        {showNew && (
          <div className="bg-white/3 border border-white/10 rounded-2xl p-5 mb-4">
            <h3 className="text-sm font-semibold text-white mb-3">Nueva plantilla</h3>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre de la plantilla"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/50 mb-3"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Hola {{nombre}}, te contactamos sobre tu deuda de ${{monto}}..."
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/50 resize-none mb-3"
            />
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 border border-emerald-500/20 disabled:opacity-50">
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl bg-white/5 text-white/50 text-sm font-medium hover:bg-white/8">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de plantillas */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 text-white/30">No hay plantillas para este departamento</div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <div key={t.id} className="bg-white/3 border border-white/8 rounded-2xl p-5">
                {editingId === t.id ? (
                  <div className="space-y-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                    />
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(t.id)} disabled={saving} className="px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 border border-emerald-500/20 disabled:opacity-50">
                        {saving ? "Guardando..." : "Guardar"}
                      </button>
                      <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-xl bg-white/5 text-white/50 text-sm font-medium hover:bg-white/8">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white mb-1">{t.name}</p>
                      <p className="text-sm text-white/50 whitespace-pre-wrap">{t.content}</p>
                      {extractVariables(t.content).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {extractVariables(t.content).map((v) => (
                            <span key={v} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">
                              {`{{${v}}}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => { setEditingId(t.id); setEditName(t.name); setEditContent(t.content); }}
                        className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs font-medium hover:bg-white/10"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
