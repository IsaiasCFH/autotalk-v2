// app/api/conversaciones/route.ts
// GET /api/conversaciones → listar conversaciones por departamento
// POST /api/conversaciones → crear conversación manual

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const department = searchParams.get("department");
  const isOpen = searchParams.get("isOpen");

  const conversaciones = await prisma.conversation.findMany({
    where: {
      ...(department ? { department: department as any } : {}),
      ...(isOpen !== null ? { isOpen: isOpen === "true" } : {}),
    },
    include: {
      contact: true,
      agent: { select: { id: true, name: true, email: true } },
      number: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1, // solo el último mensaje para el preview
      },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ ok: true, data: conversaciones });
}
