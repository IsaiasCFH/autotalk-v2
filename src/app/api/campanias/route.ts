import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CampaignStatus, MessageStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const department = searchParams.get("department");
  const campaigns = await prisma.campaign.findMany({
    where: department ? { department: department as any } : undefined,
    include: {
      agent: { select: { id: true, name: true, email: true } },
      number: true,
      numbers: { include: { number: true }, orderBy: { order: "asc" } },
      templates: { include: { template: true }, orderBy: { order: "asc" } },
      _count: { select: { messageLogs: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const campaignsWithStats = await Promise.all(
    campaigns.map(async (campaign) => {
      const logs = await prisma.messageLog.groupBy({
        by: ["status"],
        where: { campaignId: campaign.id },
        _count: { status: true },
      });
      const stats = { total: campaign._count.messageLogs, pending: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
      logs.forEach((log) => {
        const key = log.status.toLowerCase() as keyof typeof stats;
        if (key in stats) stats[key] = log._count.status;
      });
      return { ...campaign, stats };
    })
  );
  return NextResponse.json({ ok: true, data: campaignsWithStats });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json();
  const { name, department, numberIds, templateIds, contactIds, variableMap, excelData } = body;

  // Soporte para numberIds (array) o numberId (legacy)
  const resolvedNumberIds: string[] = numberIds?.length ? numberIds : (body.numberId ? [body.numberId] : []);

  if (!name || !department || !resolvedNumberIds.length || !templateIds?.length || !contactIds?.length) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const templates = await prisma.template.findMany({ where: { id: { in: templateIds } } });
  const orderedTemplates = templateIds.map((id: string) => templates.find((t) => t.id === id)).filter(Boolean);

  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds } },
    select: { id: true, phone: true },
  });

  const phoneToRow: Record<string, Record<string, string>> = {};
  const vm = (variableMap ?? {}) as Record<string, string>;
  for (const row of (excelData ?? []) as Record<string, string>[]) {
    const phoneCol = Object.keys(row).find(k =>
      ["telefono","phone","numero","cel","celular"].includes(k.toLowerCase())
    ) ?? Object.keys(row)[0];
    const phone = String(row[phoneCol] ?? "").replace(/\D/g, "");
    if (phone) phoneToRow[phone] = row;
  }

  const campaign = await prisma.$transaction(async (tx) => {
    // Usar el primer número como número principal (para compatibilidad)
    const primaryNumberId = resolvedNumberIds[0];
    const newCampaign = await tx.campaign.create({
      data: {
        name, department, status: CampaignStatus.DRAFT,
        agentId: session.user.id, numberId: primaryNumberId,
        templates: { create: templateIds.map((templateId: string, index: number) => ({ templateId, order: index })) },
        numbers: { create: resolvedNumberIds.map((numberId: string, index: number) => ({ numberId, order: index })) },
      },
    });

    const messageLogsData = contactIds.map((contactId: string, index: number) => {
      const template = orderedTemplates[index % orderedTemplates.length] as any;
      // Rotar número según índice del contacto
      const rotatedNumberId = resolvedNumberIds[index % resolvedNumberIds.length];
      const contact = contacts.find((c) => c.id === contactId);
      const excelRow = contact ? (phoneToRow[contact.phone] ?? {}) : {};
      const personalizedText = template
        ? template.content.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => {
            const col = vm[key]; return col ? ((excelRow as any)[col] ?? "") : "";
          })
        : "";
      return { campaignId: newCampaign.id, contactId, numberId: rotatedNumberId, status: MessageStatus.PENDING, messageText: personalizedText };
    });

    await tx.messageLog.createMany({ data: messageLogsData });
    return newCampaign;
  });

  return NextResponse.json({ ok: true, data: campaign }, { status: 201 });
}
