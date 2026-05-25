// app/api/compromisos/route.ts
// GET  → listar compromisos con filtros
// POST → crear compromiso manual

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CommitmentStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as CommitmentStatus | null;
  const search = searchParams.get("search");

  const compromisos = await prisma.commitment.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search ? {
        contact: {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        },
      } : {}),
    },
    include: {
      contact: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ ok: true, data: compromisos });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { contactId, status, amount, dueDate, notes } = await req.json();

  if (!contactId || !status) {
    return NextResponse.json({ error: "contactId y status son requeridos" }, { status: 400 });
  }

  const compromiso = await prisma.commitment.create({
    data: {
      contactId,
      status,
      amount: amount ? parseFloat(amount) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes ?? null,
      autoDetected: false,
    },
    include: { contact: true },
  });

  return NextResponse.json({ ok: true, data: compromiso }, { status: 201 });
}
