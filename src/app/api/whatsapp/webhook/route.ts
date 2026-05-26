// app/api/whatsapp/webhook/route.ts
// POST → recibe mensajes entrantes de Evolution API
//
// FLUJO:
// WhatsApp → Evolution → POST /api/whatsapp/webhook
// → guardar mensaje en BD
// → si la conversación viene de una campaña de cobranza → detectar intención de pago
// → si hay intención → crear/actualizar compromiso automáticamente

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectPaymentIntent } from "@/lib/intentDetector";
import { MessageStatus, CommitmentStatus } from "@prisma/client";

type EvolutionWebhookPayload = {
  event: string;
  instance: string;
  data: {
    key?: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text: string };
    };
    messageTimestamp?: number;
    pushName?: string;
    status?: string;
    id?: string;
  };
};

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json() as EvolutionWebhookPayload;
    console.log("[Webhook] Recibido:", JSON.stringify(payload).slice(0, 300));

    if (payload.event === "messages.upsert") {
      await procesarMensajeEntrante(payload);
    } else if (payload.event === "messages.update") {
      await procesarActualizacionEstado(payload);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Webhook] ERROR COMPLETO:", error);
    return NextResponse.json({ ok: true });
  }
}

async function procesarMensajeEntrante(payload: EvolutionWebhookPayload) {
  console.log("[Webhook] Procesando mensaje entrante, instance:", payload.instance);
  const { instance, data } = payload;

  if (!data.key || data.key.fromMe) return;

  const msg = data.message as any;
  const texto =
    msg?.conversation ??
    msg?.extendedTextMessage?.text ??
    msg?.imageMessage?.caption ??
    msg?.videoMessage?.caption ??
    msg?.documentMessage?.caption ??
    msg?.ephemeralMessage?.message?.conversation ??
    msg?.viewOnceMessage?.message?.imageMessage?.caption ?? "";

  // Detectar tipo de media
  let mediaType: string | null = null;
  let mediaUrl: string | null = null;
  if (msg?.imageMessage) { 
    mediaType = "image";
    try {
      const mediaRes = await fetch(
        `${process.env.EVOLUTION_URL}/chat/getBase64FromMediaMessage/${payload.instance}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_API_KEY ?? "" },
          body: JSON.stringify({ message: { key: data.key, message: data.message } }),
        }
      );
      if (mediaRes.ok) {
        const mediaData = await mediaRes.json();
        mediaUrl = mediaData.base64 ? `data:image/jpeg;base64,${mediaData.base64}` : null;
      }
    } catch { mediaUrl = null; }
  }
  else if (msg?.videoMessage) { mediaType = "video"; mediaUrl = msg.videoMessage.url ?? null; }
  else if (msg?.audioMessage) { mediaType = "audio"; mediaUrl = msg.audioMessage.url ?? null; }
  else if (msg?.documentMessage) { mediaType = "document"; mediaUrl = msg.documentMessage.url ?? null; }
  else if (msg?.stickerMessage) { mediaType = "sticker"; mediaUrl = msg.stickerMessage.url ?? null; }

  // Continuar aunque no haya texto (puede ser imagen, audio, etc.)

  const phone = data.key.remoteJid
    .replace("@s.whatsapp.net", "")
    .replace("@c.us", "");

  // Buscar número en BD
  const numero = await prisma.whatsappNumber.findFirst({
    where: { OR: [{ label: instance }, { number: instance }] },
  });

  console.log("[Webhook] Número encontrado:", numero?.id ?? "NO ENCONTRADO");
  if (!numero) return;
  console.log("[Webhook] Buscando contacto para phone:", phone);

  console.log("[Webhook] Creando/buscando contacto...");
  // Buscar o crear contacto
  const contacto = await prisma.contact.upsert({
    where: { phone },
    update: { ...(data.pushName ? { name: data.pushName } : {}) },
    create: { phone, name: data.pushName ?? null },
  });

  console.log("[Webhook] Contacto:", contacto.id, "- Buscando conversación...");
  // Buscar conversación abierta
  let conversacion = await prisma.conversation.findFirst({
    where: { contactId: contacto.id, numberId: numero.id, isOpen: true },
  });

  if (!conversacion) {
    conversacion = await prisma.conversation.create({
      data: {
        contactId: contacto.id,
        numberId: numero.id,
        department: numero.department,
        isOpen: true,
      },
    });
  }

  console.log("[Webhook] Guardando mensaje en conversación:", conversacion.id);
  // Guardar mensaje
  await prisma.message.create({
    data: {
      conversationId: conversacion.id,
      content: texto,
      fromContact: true,
      status: MessageStatus.DELIVERED,
      whatsappId: data.key.id,
      mediaUrl: mediaUrl ?? undefined,
      mediaType: mediaType ?? undefined,
      sentAt: data.messageTimestamp ? new Date(data.messageTimestamp * 1000) : new Date(),
    },
  });

  await prisma.conversation.update({
    where: { id: conversacion.id },
    data: { updatedAt: new Date() },
  });

  // ── Detección de intención de pago ──────────────────────────────────────────
  // Solo para departamento COBRANZA
  if (numero.department === "COBRANZA") {
    try {
      const intent = await detectPaymentIntent(texto, contacto.name);

      if (intent.type !== "NONE") {
        // Mapear intención a estado de compromiso
        const statusMap: Record<string, CommitmentStatus> = {
          PAID: CommitmentStatus.PAID,
          PENDING: CommitmentStatus.PENDING,
          CHURNED: CommitmentStatus.CHURNED,
          NEEDS_REVIEW: CommitmentStatus.PENDING, // lo marcamos pending con nota
        };

        const commitmentStatus = statusMap[intent.type];

        // Buscar si ya existe un compromiso PENDING para este contacto
        const existing = await prisma.commitment.findFirst({
          where: {
            contactId: contacto.id,
            status: CommitmentStatus.PENDING,
          },
          orderBy: { createdAt: "desc" },
        });

        const notes = intent.type === "CHURNED"
          ? "Cliente dice no tener contratados los servicios — requiere verificación"
          : intent.type === "NEEDS_REVIEW"
          ? `Requiere revisión manual: ${(intent as { type: string; reason: string }).reason}`
          : intent.type === "PENDING" && (intent as { type: string; rawDate: string | null }).rawDate
          ? `Cliente indicó: "${(intent as { type: string; rawDate: string | null }).rawDate}"`
          : null;

        const dueDate = intent.type === "PENDING" && (intent as { type: string; date: string | null }).date
          ? new Date((intent as { type: string; date: string | null }).date!)
          : null;

        if (existing) {
          // Actualizar compromiso existente
          await prisma.commitment.update({
            where: { id: existing.id },
            data: {
              status: commitmentStatus,
              dueDate: dueDate ?? existing.dueDate,
              notes: notes ?? existing.notes,
              rawResponse: texto,
              autoDetected: true,
            },
          });
        } else {
          // Crear nuevo compromiso
          await prisma.commitment.create({
            data: {
              contactId: contacto.id,
              status: commitmentStatus,
              dueDate,
              notes,
              rawResponse: texto,
              autoDetected: true,
            },
          });
        }
      }
    } catch (error) {
      // No romper el flujo si falla la detección
      console.error("[IntentDetector] Error en webhook:", error);
    }
  }
}

async function procesarActualizacionEstado(payload: EvolutionWebhookPayload) {
  const { data } = payload;
  if (!data.id || !data.status) return;

  const statusMap: Record<string, MessageStatus> = {
    PENDING: MessageStatus.PENDING,
    SENT: MessageStatus.SENT,
    DELIVERY_ACK: MessageStatus.DELIVERED,
    READ: MessageStatus.READ,
    PLAYED: MessageStatus.READ,
  };

  const nuevoEstado = statusMap[data.status];
  if (!nuevoEstado) return;

  await prisma.message.updateMany({
    where: { whatsappId: data.id },
    data: {
      status: nuevoEstado,
      ...(nuevoEstado === MessageStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
      ...(nuevoEstado === MessageStatus.READ ? { readAt: new Date() } : {}),
    },
  });
}
