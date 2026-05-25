// app/api/campanias/route.ts — Endpoints de campañas
//
// GET  /api/campanias → listar campañas con métricas
// POST /api/campanias → crear nueva campaña

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CampaignStatus, MessageStatus } from "@prisma/client";

// ── GET — Listar campañas con métricas ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const department = searchParams.get("department");

  const campaigns = await prisma.campaign.findMany({
    where: department ? { department: department as any } : undefined,
    include: {
      agent: { select: { id: true, name: true, email: true } },
      number: true,
      templates: { include: { template: true }, orderBy: { order: "asc" } },
      _count: { select: { messageLogs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calcular métricas para cada campaña
  const campaignsWithStats = await Promise.all(
    campaigns.map(async (campaign) => {
      const logs = await prisma.messageLog.groupBy({
        by: ["status"],
        where: { campaignId: campaign.id },
        _count: { status: true },
      });

      // Convertir el groupBy en un objeto de métricas
      const stats = {
        total: campaign._count.messageLogs,
        pending: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      };

      logs.forEach((log) => {
        const key = log.status.toLowerCase() as keyof typeof stats;
        if (key in stats) stats[key] = log._count.status;
      });

      return { ...campaign, stats };
    })
  );

  return NextResponse.json({ ok: true, data: campaignsWithStats });
}

// ── POST — Crear campaña ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { name, department, numberId, templateIds, contactIds } = body;

  if (!name || !department || !numberId || !templateIds?.length || !contactIds?.length) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  // Crear la campaña en una transacción
  // Transacción = todas las operaciones ocurren juntas o ninguna
  // Si falla crear los MessageLogs, la campaña tampoco se crea
  const campaign = await prisma.$transaction(async (tx) => {
    // 1. Crear la campaña
    const newCampaign = await tx.campaign.create({
      data: {
        name,
        department,
        status: CampaignStatus.DRAFT,
        agentId: session.user.id,
        numberId,
        templates: {
          create: templateIds.map((templateId: string, index: number) => ({
            templateId,
            order: index,
          })),
        },
      },
    });

    // 2. Crear un MessageLog por cada contacto
    // Así podemos trackear el estado individual de cada envío
    await tx.messageLog.createMany({
      data: contactIds.map((contactId: string) => ({
        campaignId: newCampaign.id,
        contactId,
        numberId,
        status: MessageStatus.PENDING,
      })),
    });

    return newCampaign;
  });

  return NextResponse.json({ ok: true, data: campaign }, { status: 201 });
}
