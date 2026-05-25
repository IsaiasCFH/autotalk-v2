// app/api/campanias/[id]/action/route.ts
// POST /api/campanias/:id/action
// Body: { action: "start" | "pause" | "resume" }

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  enqueueCampaign,
  pauseCampaign,
  resumeCampaign,
  startCampaignWorker,
} from "@/lib/campaignQueue";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { action } = await req.json();
  const { id } = params;

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

  try {
    switch (action) {
      case "start":
        if (campaign.status !== "DRAFT") {
          return NextResponse.json({ error: "Solo se pueden iniciar campañas en borrador" }, { status: 400 });
        }
        // Asegurar que el worker está corriendo antes de encolar
        startCampaignWorker();
        await enqueueCampaign(id);
        return NextResponse.json({ ok: true, message: "Campaña iniciada" });

      case "pause":
        if (campaign.status !== "RUNNING") {
          return NextResponse.json({ error: "Solo se pueden pausar campañas activas" }, { status: 400 });
        }
        await pauseCampaign(id);
        return NextResponse.json({ ok: true, message: "Campaña pausada" });

      case "resume":
        if (campaign.status !== "PAUSED") {
          return NextResponse.json({ error: "Solo se pueden reanudar campañas pausadas" }, { status: 400 });
        }
        startCampaignWorker();
        await resumeCampaign(id);
        return NextResponse.json({ ok: true, message: "Campaña reanudada" });

      default:
        return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Campaign action]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
