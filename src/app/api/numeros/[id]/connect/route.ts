// app/api/numeros/[id]/connect/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createInstance, getInstanceQR, getInstance } from "@/lib/evolution";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // En Next.js 15+ params es una Promise — hay que awaitearlo
  const { id } = await params;

  const number = await prisma.whatsappNumber.findUnique({
    where: { id },
  });

  if (!number) return NextResponse.json({ error: "Número no encontrado" }, { status: 404 });

  const instanceName = number.label ?? number.number;

  try {
    let qrData: { base64: string } | null = null;

    try {
      const created = await createInstance(instanceName);
      qrData = created.qrcode ?? null;
    } catch {
      qrData = await getInstanceQR(instanceName);
    }

    if (!qrData?.base64) {
      return NextResponse.json(
        { error: "No se pudo generar el QR. Intenta de nuevo." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: { qr: qrData.base64, instanceName },
    });
  } catch (error) {
    console.error("[Connect]", error);
    return NextResponse.json({ error: "Error al conectar con Evolution" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const number = await prisma.whatsappNumber.findUnique({
    where: { id },
  });

  if (!number) return NextResponse.json({ error: "Número no encontrado" }, { status: 404 });

  const instanceName = number.label ?? number.number;
  const instance = await getInstance(instanceName);
  const isConnected = instance?.status === "open";

  if (isConnected) {
    await prisma.whatsappNumber.update({
      where: { id },
      data: {
        status: "CONNECTED",
        number: instance?.owner ?? number.number,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    data: {
      status: instance?.status ?? "close",
      isConnected,
      profileName: instance?.profileName ?? null,
    },
  });
}