// lib/intentDetector.ts — Detector de intención de pago con OpenAI
//
// Cuando un contacto responde a una campaña de cobranza,
// este módulo analiza el texto y devuelve la intención detectada.
//
// Usamos OpenAI GPT para entender lenguaje natural:
// "ya lo transferí" → PAID
// "te caigo el lunes" → PENDING + fecha
// "hace meses que no tengo ese servicio" → CHURNED
// "no entiendo de qué me hablan" → NEEDS_REVIEW

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type PaymentIntent =
  | { type: "PAID" }
  | { type: "PENDING"; date: string | null; rawDate: string | null }
  | { type: "CHURNED" }
  | { type: "NEEDS_REVIEW"; reason: string }
  | { type: "NONE" }; // ignoró o no es relevante

// ── Detector principal ────────────────────────────────────────────────────────

export async function detectPaymentIntent(
  message: string,
  contactName?: string | null
): Promise<PaymentIntent> {
  // Si no hay API key configurada, devolver NONE
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[IntentDetector] OPENAI_API_KEY no configurada");
    return { type: "NONE" };
  }

  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // modelo más económico, suficiente para este caso
      max_tokens: 200,
      temperature: 0, // 0 = más determinista, menos creativo (lo que queremos aquí)
      messages: [
        {
          role: "system",
          content: `Eres un analizador de intenciones de pago para una empresa de cobranza.
Hoy es ${today}.
Analiza el mensaje del cliente y devuelve SOLO un JSON con este formato:

{
  "type": "PAID" | "PENDING" | "CHURNED" | "NEEDS_REVIEW" | "NONE",
  "date": "YYYY-MM-DD o null",
  "rawDate": "texto original de la fecha o null",
  "reason": "solo si type es NEEDS_REVIEW"
}

Reglas:
- PAID: el cliente dice que ya pagó (pagué, transferí, deposité, ya está pagado, etc.)
- PENDING: el cliente promete pagar en una fecha futura (mañana, el lunes, el viernes, etc.)
- CHURNED: el cliente dice que ya no tiene el servicio / ya no es cliente / se fue
- NEEDS_REVIEW: el cliente dice algo confuso, reclama, amenaza, o necesita atención humana
- NONE: el cliente ignora, saluda sin contexto, o el mensaje no es relevante para cobranza

Para PENDING, extrae la fecha exacta si es posible (convierte "mañana", "el lunes", etc. a YYYY-MM-DD basándote en hoy ${today}).
Si no puedes determinar la fecha exacta, deja date como null pero escribe el texto original en rawDate.

Devuelve SOLO el JSON, sin texto adicional.`,
        },
        {
          role: "user",
          content: `Mensaje del cliente${contactName ? ` (${contactName})` : ""}: "${message}"`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return { type: "NONE" };

    const parsed = JSON.parse(content);

    switch (parsed.type) {
      case "PAID":
        return { type: "PAID" };
      case "PENDING":
        return { type: "PENDING", date: parsed.date ?? null, rawDate: parsed.rawDate ?? null };
      case "CHURNED":
        return { type: "CHURNED" };
      case "NEEDS_REVIEW":
        return { type: "NEEDS_REVIEW", reason: parsed.reason ?? "Requiere revisión manual" };
      default:
        return { type: "NONE" };
    }
  } catch (error) {
    console.error("[IntentDetector] Error:", error);
    return { type: "NONE" };
  }
}
