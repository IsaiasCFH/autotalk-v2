import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMessageWithTyping, calcTypingDelay, formatWhatsappJid } from "@/lib/evolution";
import { MessageStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { phone, text, numberId } = await req.json();
  if (!phone || !text || !numberId) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const cleanPhone = phone.replace(/\D/g, "");

  const numero = await prisma.whatsappNumber.findUnique({ where: { id: numberId } });
  if (!numero || numero.status !== "CONNECTED") {
    return NextResponse.json({ error: "Número no conectado" }, { status: 422 });
  }

  let contacto = await prisma.contact.findFirst({ where: { phone: cleanPhone } });
  if (!contacto) {
    contacto = await prisma.contact.create({
      data: { phone: cleanPhone },
    });
  }

  let conversacion = await prisma.conversation.findFirst({
    where: { contactId: contacto.id, numberId, isOpen: true },
  });

  if (!conversacion) {
    conversacion = await prisma.conversation.create({
      data: {
        contactId: contacto.id,
        numberId,
        department: numero.department,
        agentId: session.user.id,
        isOpen: true,
      },
    });
  }

  const mensaje = await prisma.message.create({
    data: {
      conversationId: conversacion.id,
      content: text,
      fromContact: false,
      status: MessageStatus.PENDING,
    },
  });

  const instanceName = numero.label ?? numero.number;
  const typingDelay = calcTypingDelay(text);

  try {
    await sendMessageWithTyping(instanceName, formatWhatsappJid(cleanPhone), text, typingDelay);
    await prisma.message.update({
      where: { id: mensaje.id },
      data: { status: MessageStatus.SENT, sentAt: new Date() },
    });
    await prisma.conversation.update({
      where: { id: conversacion.id },
      data: { updatedAt: new Date() },
    });
    return NextResponse.json({ ok: true, conversationId: conversacion.id });
  } catch {
    await prisma.message.update({
      where: { id: mensaje.id },
      data: { status: MessageStatus.FAILED },
    });
    return NextResponse.json({ error: "Error al enviar mensaje" }, { status: 500 });
  }
}
