// app/api/compromisos/[id]/route.ts
// PATCH → actualizar compromiso (edición manual por agente)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const { status, amount, dueDate, notes } = await req.json();

  const compromiso = await prisma.commitment.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(amount !== undefined ? { amount: amount ? parseFloat(amount) : null } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
    include: { contact: true },
  });

  return NextResponse.json({ ok: true, data: compromiso });
}
