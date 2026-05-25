// types/index.ts — Tipos TypeScript globales de AutoTalk
//
// ¿Por qué definir tipos propios si Prisma genera los suyos?
// Los tipos de Prisma son para la BD. Estos tipos son para la UI:
// - A veces queremos un subconjunto (sin la contraseña del agente)
// - A veces queremos datos "populados" (conversación + contacto + mensajes)
// - A veces queremos tipos para formularios o estados de UI
//
// Regla: nunca exponer el tipo completo de Prisma al frontend
// (podría incluir campos sensibles como passwords)

import type {
  Agent,
  Contact,
  Conversation,
  Message,
  Campaign,
  MessageLog,
  WhatsappNumber,
  Department,
  Role,
  CampaignStatus,
  MessageStatus,
  WhatsappStatus,
} from "@prisma/client";

// Re-exportamos los enums de Prisma para usarlos en el frontend
export type { Department, Role, CampaignStatus, MessageStatus, WhatsappStatus };

// ─── Agente (sin password) ────────────────────────────────
// Omit<T, K> = el tipo T pero sin los campos K
// Nunca mandamos la contraseña al cliente
export type SafeAgent = Omit<Agent, "password">;

// ─── Conversación con datos relacionados ──────────────────
// Cuando cargamos el inbox, necesitamos la conversación + contacto + último mensaje
export type ConversationWithRelations = Conversation & {
  contact: Contact;
  agent: SafeAgent | null;
  messages: Message[];
  number: WhatsappNumber;
  _count: { messages: number };
};

// ─── Mensaje ──────────────────────────────────────────────
export type MessageWithMeta = Message & {
  conversation: { contact: Contact };
};

// ─── Campaña con métricas ─────────────────────────────────
export type CampaignWithStats = Campaign & {
  agent: SafeAgent;
  number: WhatsappNumber;
  messageLogs: MessageLog[];
  _count: { messageLogs: number };
  // Calculados en el servidor (no en BD)
  stats?: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    pending: number;
  };
};

// ─── Número de WhatsApp ───────────────────────────────────
export type WhatsappNumberWithStats = WhatsappNumber & {
  _count: { conversations: number; campaigns: number };
};

// ─── Departamento con metadata para UI ───────────────────
// Los enums no tienen "label" ni "color" — los definimos nosotros
export const DEPARTMENT_META: Record<
  Department,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  COBRANZA: {
    label: "Cobranza",
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/20",
    icon: "💰",
  },
  SELECCION: {
    label: "Selección",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    icon: "👥",
  },
  CONTABILIDAD: {
    label: "Contabilidad",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10 border-yellow-500/20",
    icon: "📊",
  },
  VENTAS: {
    label: "Ventas",
    color: "text-green-400",
    bgColor: "bg-green-500/10 border-green-500/20",
    icon: "🚀",
  },
  CSX: {
    label: "CSX",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/20",
    icon: "🎧",
  },
};

// ─── Estado de UI para el sidebar ─────────────────────────
export type SidebarState = {
  isOpen: boolean;
  activeDepartment: Department | null;
  activeSection:
    | "inbox"
    | "campanias"
    | "contactos"
    | "numeros"
    | "compromisos"
    | "configuracion";
};

// ─── Respuesta genérica de API ────────────────────────────
// Estandarizamos cómo responden TODAS las API routes
// { ok: true, data: ... } o { ok: false, error: "..." }
export type ApiResponse<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };
