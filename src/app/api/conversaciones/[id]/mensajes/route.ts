// app/api/conversaciones/[id]/mensajes/route.ts
// GET  → obtener mensajes de una conversación
// POST → enviar mensaje (con validación de número conectado)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMessageWithTyping, calcTypingDelay, formatWhatsappJid } from "@/lib/evolution";
import { MessageStatus } from "@prisma/client";

// ── GET — Obtener mensajes ────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const mensajes = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ ok: true, data: mensajes });
}

// ── POST — Enviar mensaje ─────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const { text } = await req.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "El mensaje no puede estar vacío" }, { status: 400 });
  }

  // Obtener la conversación con el número y contacto
  const conversacion = await prisma.conversation.findUnique({
    where: { id },
    include: {
      number: true,
      contact: true,
    },
  });

  if (!conversacion) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  // Verificar que el número está conectado
  // Si no hay número o está desconectado → error con código especial
  if (!conversacion.number || conversacion.number.status !== "CONNECTED") {
    return NextResponse.json(
      {
        error: "NO_NUMBER_CONNECTED",
        message: "No hay un número de WhatsApp conectado para este departamento",
        department: conversacion.department,
      },
      { status: 422 }
    );
  }

  // Guardar el mensaje en BD primero (optimistic — aparece de inmediato)
  const mensaje = await prisma.message.create({
    data: {
      conversationId: id,
      content: text,
      fromContact: false, // lo envía el agente
      status: MessageStatus.PENDING,
    },
  });

  // Enviar via Evolution con typing simulado
  const instanceName = conversacion.number.label ?? conversacion.number.number;
  const typingDelay = calcTypingDelay(text);

  try {
    await sendMessageWithTyping(
      instanceName,
      formatWhatsappJid(conversacion.contact.phone),
      text,
      typingDelay
    );

    // Actualizar estado a SENT
    await prisma.message.update({
      where: { id: mensaje.id },
      data: { status: MessageStatus.SENT, sentAt: new Date() },
    });

    // Actualizar updatedAt de la conversación para que suba en el inbox
    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ ok: true, data: { ...mensaje, status: "SENT" } });
  } catch (error) {
    // Si falla el envío, marcar como fallido
    await prisma.message.update({
      where: { id: mensaje.id },
      data: { status: MessageStatus.FAILED },
    });

    return NextResponse.json({ error: "Error al enviar mensaje" }, { status: 500 });
  }
}
