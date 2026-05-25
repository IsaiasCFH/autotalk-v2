// lib/evolution.ts — Cliente para Evolution API
//
// Centralizar todas las llamadas a Evolution aquí tiene dos ventajas:
// 1. Si Evolution cambia su API, solo tocamos este archivo
// 2. Manejo de errores consistente en toda la app
//
// Evolution API v2.2.3 — el QR se obtiene via fetchInstances con fetchQrCode=true
// (en v2 el endpoint /instance/connect no devuelve el QR via REST)

const EVOLUTION_URL = process.env.EVOLUTION_URL ?? "http://localhost:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY ?? "";

// Headers que van en TODAS las requests a Evolution
const baseHeaders = {
  "Content-Type": "application/json",
  apikey: EVOLUTION_API_KEY,
};

// ── Tipos de Evolution API ────────────────────────────────────────────────────

export type EvolutionInstance = {
  instanceName: string;
  status: "open" | "close" | "connecting";
  owner?: string;
  profileName?: string;
  profilePicUrl?: string;
  qrcode?: { base64?: string; count?: number };
};

export type SendMessageResult = {
  key: { remoteJid: string; id: string };
  status: string;
};

// ── Helper interno ────────────────────────────────────────────────────────────

async function evolutionFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${EVOLUTION_URL}${path}`, {
    ...options,
    headers: { ...baseHeaders, ...options.headers },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution API error ${res.status}: ${body}`);
  }

  return res.json();
}

// ── Instancias ────────────────────────────────────────────────────────────────

// Obtener todas las instancias conectadas
export async function getInstances(): Promise<EvolutionInstance[]> {
  try {
    const data = await evolutionFetch<any[]>("/instance/fetchInstances");
    // Evolution v2 devuelve un array de objetos con estructura diferente
    // normalizamos para que siempre tengamos instanceName y status
    return data.map((i) => ({
      instanceName: i.name ?? i.instanceName,
      status: i.connectionStatus === "open" ? "open" : i.connectionStatus === "connecting" ? "connecting" : "close",
      owner: i.ownerJid ?? i.owner,
      profileName: i.profileName,
      profilePicUrl: i.profilePicUrl,
    }));
  } catch {
    return [];
  }
}

// Obtener una instancia por nombre
export async function getInstance(instanceName: string): Promise<EvolutionInstance | null> {
  try {
    const data = await evolutionFetch<any[]>(
      `/instance/fetchInstances?instanceName=${instanceName}`
    );
    if (!data[0]) return null;
    const i = data[0];
    return {
      instanceName: i.name ?? i.instanceName,
      status: i.connectionStatus === "open" ? "open" : i.connectionStatus === "connecting" ? "connecting" : "close",
      owner: i.ownerJid ?? i.owner,
      profileName: i.profileName,
      profilePicUrl: i.profilePicUrl,
    };
  } catch {
    return null;
  }
}

// Obtener QR de una instancia existente
// En Evolution v2 el QR se obtiene via fetchInstances con fetchQrCode=true
export async function getInstanceQR(instanceName: string): Promise<{ base64: string } | null> {
  try {
    const data = await evolutionFetch<any[]>(
      `/instance/fetchInstances?instanceName=${instanceName}&fetchQrCode=true`
    );
    const instance = data[0];

    if (instance?.qrcode?.base64) {
      return { base64: instance.qrcode.base64 };
    }
    return null;
  } catch {
    return null;
  }
}

// Crear una nueva instancia y esperar a que genere el QR
export async function createInstance(instanceName: string): Promise<{ qrcode?: { base64: string } }> {
  // Crear la instancia
  await evolutionFetch("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    }),
  });

  // Esperar 5 segundos para que Evolution genere el QR internamente
  await sleep(5000);

  // Obtener el QR via fetchInstances
  const qr = await getInstanceQR(instanceName);
  return { qrcode: qr ?? undefined };
}

// Desconectar una instancia
export async function disconnectInstance(instanceName: string): Promise<void> {
  await evolutionFetch(`/instance/logout/${instanceName}`, { method: "DELETE" });
}

// ── Mensajería ────────────────────────────────────────────────────────────────

// Activar el estado "escribiendo..." en el chat
export async function sendTyping(
  instanceName: string,
  to: string,
  duration: number
): Promise<void> {
  try {
    await evolutionFetch(`/chat/sendPresence/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        number: to,
        options: {
          presence: "composing",
          delay: duration,
        },
      }),
    });
  } catch {
    console.warn(`[Evolution] typing falló para ${to}`);
  }
}

// Enviar mensaje de texto
export async function sendTextMessage(
  instanceName: string,
  to: string,
  text: string
): Promise<SendMessageResult> {
  return evolutionFetch<SendMessageResult>(`/message/sendText/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      number: to,
      text,
      options: {
        delay: 0,
        presence: "composing",
      },
    }),
  });
}

// Enviar mensaje con delay de typing simulado
export async function sendMessageWithTyping(
  instanceName: string,
  to: string,
  text: string,
  typingDurationMs: number
): Promise<SendMessageResult> {
  // 1. Activar "escribiendo..."
  await sendTyping(instanceName, to, typingDurationMs);

  // 2. Esperar ese tiempo
  await sleep(typingDurationMs);

  // 3. Enviar el mensaje
  return sendTextMessage(instanceName, to, text);
}

// ── Utilidades ────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Calcular el delay de typing según el largo del mensaje
// Simula velocidad de escritura humana (~40 palabras por minuto)
export function calcTypingDelay(text: string): number {
  const words = text.trim().split(/\s+/).length;
  const baseMs = Math.min(words * 1500, 8000);
  const minMs = Math.max(baseMs * 0.7, 1000);
  const maxMs = Math.min(baseMs * 1.3, 10000);
  return Math.floor(Math.random() * (maxMs - minMs) + minMs);
}

// Delay entre mensajes consecutivos (3-8 segundos)
export function calcInterMessageDelay(): number {
  return Math.floor(Math.random() * (8000 - 3000) + 3000);
}

// Formatear número al formato JID de WhatsApp
// "56912345678" → "56912345678@s.whatsapp.net"
export function formatWhatsappJid(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  return `${clean}@s.whatsapp.net`;
}