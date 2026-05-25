// app/api/numeros/route.ts — Gestión de números WhatsApp
//
// GET  /api/numeros → listar números con estado real de Evolution
// POST /api/numeros → registrar un nuevo número en la BD

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInstances } from "@/lib/evolution";
import { WhatsappStatus } from "@prisma/client";

// ── GET — Listar números ──────────────────────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Obtener números de la BD
  const numbers = await prisma.whatsappNumber.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { conversations: true, campaigns: true } },
    },
  });

  // Obtener estado real de Evolution (qué instancias están conectadas)
  const instances = await getInstances();

  // Cruzar datos BD + Evolution para tener el estado real
  // Evolution es la fuente de verdad para el estado de conexión
  const numbersWithStatus = numbers.map((num) => {
    const instance = instances.find(
      (i) => i.instanceName === (num.label ?? num.number)
    );

    // Si Evolution dice que está "open" → CONNECTED, si no → DISCONNECTED
    const realStatus: WhatsappStatus = instance?.status === "open"
      ? "CONNECTED"
      : "DISCONNECTED";

    return {
      ...num,
      status: realStatus,
      evolutionData: instance ?? null,
    };
  });

  return NextResponse.json({ ok: true, data: numbersWithStatus });
}

// ── POST — Crear número ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { number, label, department } = body;

  if (!number || !department) {
    return NextResponse.json({ error: "Número y departamento son requeridos" }, { status: 400 });
  }

  // Verificar que no existe ya ese número
  const existing = await prisma.whatsappNumber.findUnique({
    where: { number },
  });

  if (existing) {
    return NextResponse.json({ error: "Ese número ya está registrado" }, { status: 409 });
  }

  const newNumber = await prisma.whatsappNumber.create({
    data: {
      number,
      label: label || null,
      department,
      status: "DISCONNECTED",
    },
  });

  return NextResponse.json({ ok: true, data: newNumber }, { status: 201 });
}
