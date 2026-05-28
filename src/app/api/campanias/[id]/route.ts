import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { id } = await params;

  try {
    await prisma.messageLog.deleteMany({ where: { campaignId: id } });
    await prisma.campaignTemplate.deleteMany({ where: { campaignId: id } });
    await prisma.campaignNumber.deleteMany({ where: { campaignId: id } });
    await prisma.campaign.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al eliminar campaña" }, { status: 500 });
  }
}
