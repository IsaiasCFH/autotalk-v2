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
  const { name, department, numberId, templateIds, contactIds, variableMap, excelData } = body;
  if (!name || !department || !numberId || !templateIds?.length || !contactIds?.length) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }
  const templates = await prisma.template.findMany({ where: { id: { in: templateIds } } });
  const orderedTemplates = templateIds.map((id: string) => templates.find((t) => t.id === id)).filter(Boolean);
  const campaign = await prisma.$transaction(async (tx) => {
    const newCampaign = await tx.campaign.create({
      data: {
        name, department, status: CampaignStatus.DRAFT,
        agentId: session.user.id, numberId,
        templates: { create: templateIds.map((templateId: string, index: number) => ({ templateId, order: index })) },
      },
    });
    const messageLogsData = contactIds.map((contactId: string, index: number) => {
      const template = orderedTemplates[index % orderedTemplates.length] as any;
      const excelRow = (excelData?.[index] ?? {}) as Record<string, string>;
      const vm = (variableMap ?? {}) as Record<string, string>;
      const personalizedText = template
        ? template.content.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => {
            const col = vm[key]; return col ? (excelRow[col] ?? "") : "";
          })
        : "";
      return { campaignId: newCampaign.id, contactId, numberId, status: MessageStatus.PENDING, messageText: personalizedText };
    });
    await tx.messageLog.createMany({ data: messageLogsData });
    return newCampaign;
  });
  return NextResponse.json({ ok: true, data: campaign }, { status: 201 });
}
