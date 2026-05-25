// app/api/plantillas/route.ts
// GET  → listar plantillas por departamento
// POST → crear plantilla

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const department = searchParams.get("department");

  const plantillas = await prisma.template.findMany({
    where: department ? { department: department as any } : undefined,
    include: {
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, data: plantillas });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { name, content, department } = await req.json();

  if (!name || !content || !department) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const plantilla = await prisma.template.create({
    data: {
      name,
      content,
      department,
      agentId: session.user.id,
    },
  });

  return NextResponse.json({ ok: true, data: plantilla }, { status: 201 });
}
