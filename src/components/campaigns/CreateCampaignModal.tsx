"use client";
// components/campaigns/CreateCampaignModal.tsx
//
// Modal de 3 pasos para crear una campaña:
// Paso 1 → Info básica (nombre, departamento, número)
// Paso 2 → Plantilla del mensaje con variables {{variable}}
// Paso 3 → Contactos desde Excel (.xlsx) con mapeo de columnas

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEPARTMENT_META } from "@/types";
import type { Department } from "@prisma/client";
import * as XLSX from "xlsx";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type WhatsappNumber = {
  id: string;
  number: string;
  label: string | null;
  department: Department;
  status: string;
};

type Template = {
  id: string;
  name: string;
  content: string;
  department: Department;
};

// Fila del Excel — columnas dinámicas
type ExcelRow = Record<string, string>;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const DEPT_OPTIONS = Object.entries(DEPARTMENT_META).map(([value, meta]) => ({
  value: value as Department,
  label: meta.label,
  icon: meta.icon,
}));

// Extrae variables {{variable}} de un texto
function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
}

// Reemplaza variables en un texto con los valores del mapa
function applyVariables(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}

// ── Componente principal ──────────────────────────────────────────────────────

export function CreateCampaignModal({ isOpen, onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Paso 1
  const [name, setName] = useState("");
  const [department, setDepartment] = useState<Department>("COBRANZA");
  const [numbers, setNumbers] = useState<WhatsappNumber[]>([]);
  const [selectedNumberId, setSelectedNumberId] = useState("");
  const [loadingNumbers, setLoadingNumbers] = useState(false);

  // Paso 2
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Paso 3 — Excel
  const [excelRows, setExcelRows] = useState<ExcelRow[]>([]);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({}); // variable → columna
  const [phoneColumn, setPhoneColumn] = useState(""); // columna del teléfono
  const [nameColumn, setNameColumn] = useState(""); // columna del nombre (opcional)
  const [unmappedVars, setUnmappedVars] = useState<string[]>([]); // variables sin columna
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  // Plantilla seleccionada
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const templateVars = selectedTemplate ? extractVariables(selectedTemplate.content) : [];

  // ── Paso 1 ────────────────────────────────────────────────────────────────

  const handleDeptChange = async (dept: Department) => {
    setDepartment(dept);
    setSelectedNumberId("");
    setLoadingNumbers(true);
    try {
      const res = await fetch("/api/numeros");
      const data = await res.json();
      if (data.ok) {
        const filtered = data.data.filter(
          (n: WhatsappNumber) => n.department === dept && n.status === "CONNECTED"
        );
        setNumbers(filtered);
        if (filtered.length === 1) setSelectedNumberId(filtered[0].id);
      }
    } catch {
      toast.error("Error al cargar números");
    } finally {
      setLoadingNumbers(false);
    }
  };

  const handleStep1Next = async () => {
    if (!name.trim()) return toast.error("Ingresa un nombre para la campaña");
    if (!selectedNumberId && numbers.length > 0) return toast.error("Selecciona un número");
    if (numbers.length === 0) return toast.error("No hay números conectados en este departamento");

    setLoadingTemplates(true);
    try {
      const res = await fetch(`/api/plantillas?department=${department}`);
      const data = await res.json();
      if (data.ok) setTemplates(data.data);
    } catch {
      toast.error("Error al cargar plantillas");
    } finally {
      setLoadingTemplates(false);
    }
    setStep(2);
  };

  // ── Paso 2 ────────────────────────────────────────────────────────────────

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim() || !newTemplateContent.trim()) {
      return toast.error("Completa nombre y contenido de la plantilla");
    }
    setLoading(true);
    try {
      const res = await fetch("/api/plantillas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTemplateName, content: newTemplateContent, department }),
      });
      const data = await res.json();
      if (data.ok) {
        setTemplates((prev) => [data.data, ...prev]);
        setSelectedTemplateId(data.data.id);
        setShowNewTemplate(false);
        setNewTemplateName("");
        setNewTemplateContent("");
        toast.success("Plantilla creada");
      }
    } catch {
      toast.error("Error al crear plantilla");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Next = () => {
    if (!selectedTemplateId) return toast.error("Selecciona o crea una plantilla");
    setStep(3);
  };

  // ── Paso 3 — Leer Excel ───────────────────────────────────────────────────

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      // Leer el archivo con SheetJS
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convertir a JSON — cada fila es un objeto con las columnas como keys
      const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
        raw: false,      // todo como string
        defval: "",      // valor por defecto para celdas vacías
      });

      if (rows.length === 0) {
        toast.error("El archivo está vacío");
        return;
      }

      // Obtener columnas del Excel
      const cols = Object.keys(rows[0]);
      setExcelColumns(cols);
      setExcelRows(rows);

      // Auto-detectar columna de teléfono
      const phoneCol = cols.find((c) =>
        ["telefono", "teléfono", "phone", "numero", "número", "cel", "celular"].includes(
          c.toLowerCase()
        )
      ) ?? "";
      setPhoneColumn(phoneCol);

      // Auto-detectar columna de nombre
      const nameCol = cols.find((c) =>
        ["nombre", "name", "cliente", "contacto"].includes(c.toLowerCase())
      ) ?? "";
      setNameColumn(nameCol);

      // Auto-mapear variables de la plantilla a columnas del Excel
      const autoMap: Record<string, string> = {};
      const unmapped: string[] = [];

      for (const variable of templateVars) {
        // Buscar columna con nombre similar a la variable
        const match = cols.find(
          (c) => c.toLowerCase() === variable.toLowerCase()
        );
        if (match) {
          autoMap[variable] = match;
        } else {
          unmapped.push(variable);
        }
      }

      setColumnMap(autoMap);
      setUnmappedVars(unmapped);

      if (unmapped.length > 0) {
        toast.info(`${unmapped.length} variable(s) sin columna — mapéalas abajo`);
      } else {
        toast.success(`${rows.length} filas cargadas`);
      }
    } catch (err) {
      toast.error("Error al leer el Excel. Verifica que sea un archivo válido.");
      console.error(err);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  // Preview del mensaje con los datos de la primera fila
  const previewMessage = selectedTemplate && excelRows.length > 0
    ? applyVariables(selectedTemplate.content, buildValues(excelRows[0], columnMap, phoneColumn, nameColumn))
    : selectedTemplate?.content ?? "";

  // ── Crear campaña ─────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (excelRows.length === 0) return toast.error("Carga un Excel con contactos primero");
    if (!phoneColumn) return toast.error("Selecciona la columna del teléfono");

    setLoading(true);
    try {
      // 1. Importar contactos al sistema
      const contactsToImport = excelRows.map((row) => ({
        phone: String(row[phoneColumn] ?? "").replace(/\D/g, ""),
        name: nameColumn ? (row[nameColumn] ?? null) : null,
        // Guardar todos los datos del Excel en metadata para las variables
        metadata: row,
      }));

      const importRes = await fetch("/api/contactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactsToImport),
      });
      const importData = await importRes.json();
      if (!importData.ok) {
        toast.error("Error al importar contactos");
        return;
      }

      // 2. Obtener los IDs de los contactos importados
      const phones = contactsToImport.map((c) => c.phone).filter(Boolean);
      const contactsRes = await fetch(`/api/contactos?phones=${phones.join(",")}`);
      const contactsData = await contactsRes.json();

      if (!contactsData.ok || !contactsData.data?.length) {
        toast.error("Error al obtener contactos");
        return;
      }

      // 3. Crear la campaña
      const campaignRes = await fetch("/api/campanias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          department,
          numberId: selectedNumberId,
          templateIds: [selectedTemplateId],
          contactIds: contactsData.data.map((c: { id: string }) => c.id),
          // Pasar el mapeo de variables para personalizar mensajes
          variableMap: columnMap,
          excelData: excelRows, // datos del Excel para personalización
        }),
      });
      const campaignData = await campaignRes.json();

      if (campaignData.ok) {
        toast.success(`¡Campaña creada con ${excelRows.length} contactos!`);
        onCreated();
        handleClose();
      } else {
        toast.error(campaignData.error);
      }
    } catch {
      toast.error("Error al crear campaña");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setName("");
    setDepartment("COBRANZA");
    setNumbers([]);
    setSelectedNumberId("");
    setTemplates([]);
    setSelectedTemplateId("");
    setExcelRows([]);
    setExcelColumns([]);
    setColumnMap({});
    setPhoneColumn("");
    setNameColumn("");
    setUnmappedVars([]);
    onClose();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div
        className="relative w-full max-w-lg bg-[#0d0d1a] border border-white/10 rounded-2xl shadow-2xl animate-fade-in flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con pasos */}
        <div className="px-6 py-5 border-b border-white/8 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">Nueva campaña</h2>
            <div className="flex items-center gap-2 mt-1">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors",
                    step > s ? "bg-emerald-500 text-white" :
                    step === s ? "bg-emerald-500 text-white" :
                    "bg-white/10 text-white/30"
                  )}>
                    {step > s ? "✓" : s}
                  </div>
                  {s < 3 && <div className={cn("w-6 h-px transition-colors", step > s ? "bg-emerald-500" : "bg-white/10")} />}
                </div>
              ))}
              <span className="text-xs text-white/30 ml-1">
                {step === 1 ? "Info básica" : step === 2 ? "Plantilla" : "Excel + Contactos"}
              </span>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 text-white/30 hover:text-white/60 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── PASO 1 ── */}
          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Nombre de la campaña</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Cobranza Mayo 2026"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Departamento</label>
                <div className="grid grid-cols-3 gap-2">
                  {DEPT_OPTIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => handleDeptChange(d.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-3 rounded-xl border text-sm transition-all",
                        department === d.value
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-white/3 border-white/8 text-white/40 hover:bg-white/5"
                      )}
                    >
                      <span className="text-xl">{d.icon}</span>
                      <span className="text-xs">{d.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  Número de envío
                  {loadingNumbers && <span className="ml-2 text-white/20 normal-case font-normal">cargando...</span>}
                </label>
                {numbers.length === 0 && !loadingNumbers ? (
                  <div className="px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/15 text-sm text-red-400">
                    No hay números conectados en {DEPARTMENT_META[department].label}.
                    Ve a <strong>Números</strong> y conecta uno primero.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {numbers.map((num) => (
                      <button
                        key={num.id}
                        onClick={() => setSelectedNumberId(num.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                          selectedNumberId === num.id
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : "bg-white/3 border-white/8 hover:bg-white/5"
                        )}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-white">{num.label ?? num.number}</p>
                          <p className="text-xs text-white/30">{num.number}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── PASO 2 ── */}
          {step === 2 && (
            <>
              {!showNewTemplate ? (
                <>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Plantilla</label>
                    <button onClick={() => setShowNewTemplate(true)} className="text-xs text-emerald-400 hover:text-emerald-300">
                      + Nueva plantilla
                    </button>
                  </div>

                  {loadingTemplates ? (
                    <div className="flex justify-center py-6">
                      <div className="w-5 h-5 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <p className="text-sm text-white/30 mb-3">No hay plantillas para este departamento</p>
                      <button
                        onClick={() => setShowNewTemplate(true)}
                        className="px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20"
                      >
                        Crear primera plantilla
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTemplateId(t.id)}
                          className={cn(
                            "w-full text-left px-4 py-3 rounded-xl border transition-all",
                            selectedTemplateId === t.id
                              ? "bg-emerald-500/10 border-emerald-500/30"
                              : "bg-white/3 border-white/8 hover:bg-white/5"
                          )}
                        >
                          <p className="text-sm font-medium text-white">{t.name}</p>
                          <p className="text-xs text-white/40 mt-1 line-clamp-2">{t.content}</p>
                          {/* Mostrar variables detectadas */}
                          {extractVariables(t.content).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {extractVariables(t.content).map((v) => (
                                <span key={v} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">
                                  {`{{${v}}}`}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Nueva plantilla</label>
                    <button onClick={() => setShowNewTemplate(false)} className="text-xs text-white/30 hover:text-white/60">← Volver</button>
                  </div>
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Nombre de la plantilla"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                  <textarea
                    value={newTemplateContent}
                    onChange={(e) => setNewTemplateContent(e.target.value)}
                    placeholder={"Hola {{nombre}}, te contactamos sobre tu deuda de ${{monto}}..."}
                    rows={5}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                  />
                  <div className="bg-white/3 rounded-xl p-3">
                    <p className="text-xs text-white/40 mb-1">💡 Variables disponibles</p>
                    <p className="text-xs text-white/30">
                      Usa <code className="text-emerald-400">{"{{nombre}}"}</code>, <code className="text-emerald-400">{"{{monto}}"}</code>, etc.
                      Las columnas del Excel se mapearán automáticamente a estas variables en el paso siguiente.
                    </p>
                  </div>
                  <button
                    onClick={handleCreateTemplate}
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20 disabled:opacity-50"
                  >
                    {loading ? "Guardando..." : "Guardar plantilla"}
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── PASO 3 ── */}
          {step === 3 && (
            <>
              {/* Upload Excel */}
              <div>
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider block mb-2">
                  Archivo Excel / CSV
                </label>
                <label className={cn(
                  "flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all",
                  excelRows.length > 0
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-white/10 bg-white/3 hover:border-white/20"
                )}>
                  {importing ? (
                    <div className="w-6 h-6 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                  ) : excelRows.length > 0 ? (
                    <>
                      <span className="text-2xl">✅</span>
                      <p className="text-sm text-emerald-400 font-medium">{excelRows.length} filas cargadas</p>
                      <p className="text-xs text-white/30">Columnas: {excelColumns.join(", ")}</p>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-white/20">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <p className="text-sm text-white/40">Arrastra o haz clic para subir</p>
                      <p className="text-xs text-white/20">.xlsx, .xls, .csv</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Mapeo de columnas — solo si hay datos */}
              {excelRows.length > 0 && (
                <>
                  {/* Columna del teléfono — obligatorio */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                      Columna del teléfono <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={phoneColumn}
                      onChange={(e) => setPhoneColumn(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                    >
                      <option value="">Selecciona una columna...</option>
                      {excelColumns.map((c) => (
                        <option key={c} value={c} className="bg-[#0d0d1a]">{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Columna del nombre — opcional */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                      Columna del nombre <span className="text-white/20">(opcional)</span>
                    </label>
                    <select
                      value={nameColumn}
                      onChange={(e) => setNameColumn(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                    >
                      <option value="">Sin columna de nombre</option>
                      {excelColumns.map((c) => (
                        <option key={c} value={c} className="bg-[#0d0d1a]">{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Mapeo de variables de la plantilla */}
                  {templateVars.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                        Mapeo de variables
                      </label>
                      <p className="text-xs text-white/30">
                        Indica qué columna del Excel corresponde a cada variable de la plantilla.
                      </p>
                      {templateVars.map((variable) => (
                        <div key={variable} className="flex items-center gap-3">
                          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded w-28 flex-shrink-0 text-center">
                            {`{{${variable}}}`}
                          </span>
                          <span className="text-white/30 text-xs">→</span>
                          <select
                            value={columnMap[variable] ?? ""}
                            onChange={(e) =>
                              setColumnMap((prev) => ({ ...prev, [variable]: e.target.value }))
                            }
                            className={cn(
                              "flex-1 px-3 py-1.5 rounded-lg bg-white/5 border text-white text-sm focus:outline-none transition-all",
                              columnMap[variable]
                                ? "border-emerald-500/30"
                                : "border-red-500/30"
                            )}
                          >
                            <option value="">Sin mapear</option>
                            {excelColumns.map((c) => (
                              <option key={c} value={c} className="bg-[#0d0d1a]">{c}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Preview del mensaje */}
                  {selectedTemplate && (
                    <div className="bg-white/3 rounded-xl p-4 border border-white/8">
                      <p className="text-xs text-white/40 mb-2">👁 Preview (primera fila)</p>
                      <p className="text-sm text-white/80 whitespace-pre-wrap">
                        {previewMessage}
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 flex gap-2 flex-shrink-0">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm font-medium hover:bg-white/8 transition-colors"
            >
              ← Atrás
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={step === 1 ? handleStep1Next : handleStep2Next}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20"
            >
              Siguiente →
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={loading || excelRows.length === 0 || !phoneColumn}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20 disabled:opacity-50"
            >
              {loading ? "Creando..." : `Crear campaña (${excelRows.length} contactos)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper — construye el mapa de valores para reemplazar variables
function buildValues(
  row: ExcelRow,
  columnMap: Record<string, string>,
  phoneColumn: string,
  nameColumn: string
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [variable, column] of Object.entries(columnMap)) {
    values[variable] = row[column] ?? "";
  }
  // Siempre disponibles
  if (phoneColumn) values["telefono"] = row[phoneColumn] ?? "";
  if (nameColumn) values["nombre"] = row[nameColumn] ?? "";
  return values;
}
