// app/api/contactos/route.ts
// GET  → listar contactos
// POST → crear contacto o importar desde Excel (JSON parseado en el frontend)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const phones = searchParams.get("phones");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 50;

  // Si viene phones=, filtrar solo esos teléfonos
  if (phones) {
    const phoneList = phones.split(",").map(p => p.trim()).filter(Boolean);
    const contactos = await prisma.contact.findMany({
      where: { phone: { in: phoneList } },
      include: { _count: { select: { conversations: true, commitments: true } } },
    });
    return NextResponse.json({ ok: true, data: contactos, total: contactos.length, page: 1 });
  }

  const contactos = await prisma.contact.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    include: {
      _count: { select: { conversations: true, commitments: true } },
    },
  });

  const total = await prisma.contact.count({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        }
      : undefined,
  });

  return NextResponse.json({ ok: true, data: contactos, total, page });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();

  // Importación masiva — array de contactos
  if (Array.isArray(body)) {
    const results = { created: 0, skipped: 0, errors: 0 };

    for (const row of body) {
      const phone = String(row.phone ?? row.telefono ?? row.numero ?? "").replace(/\D/g, "");
      const name = String(row.name ?? row.nombre ?? "").trim() || null;

      if (!phone || phone.length < 8) {
        results.errors++;
        continue;
      }

      try {
        await prisma.contact.upsert({
          where: { phone },
          update: { ...(name ? { name } : {}) },
          create: { phone, name },
        });
        results.created++;
      } catch {
        results.skipped++;
      }
    }

    return NextResponse.json({ ok: true, data: results });
  }

  // Crear un solo contacto
  const { phone, name } = body;
  const cleanPhone = String(phone ?? "").replace(/\D/g, "");

  if (!cleanPhone) {
    return NextResponse.json({ error: "Teléfono requerido" }, { status: 400 });
  }

  const existing = await prisma.contact.findUnique({ where: { phone: cleanPhone } });
  if (existing) {
    return NextResponse.json({ error: "El contacto ya existe" }, { status: 409 });
  }

  const contacto = await prisma.contact.create({
    data: { phone: cleanPhone, name: name || null },
  });

  return NextResponse.json({ ok: true, data: contacto }, { status: 201 });
}
