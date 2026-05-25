// app/api/agentes/route.ts
// GET  → listar agentes
// POST → crear agente

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role, Department } from "@prisma/client";

// ── GET — Listar agentes ──────────────────────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Solo ADMIN puede ver la lista de agentes
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const agentes = await prisma.agent.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departments: true,
      isActive: true,
      createdAt: true,
      // Nunca devolver password
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, data: agentes });
}

// ── POST — Crear agente ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { name, email, password, role, departments } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Nombre, email y contraseña son requeridos" }, { status: 400 });
  }

  // Verificar que el email no exista
  const existing = await prisma.agent.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un agente con ese email" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const agente = await prisma.agent.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: role ?? Role.AGENT,
      departments: departments ?? [],
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departments: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, data: agente }, { status: 201 });
}
