// lib/campaignQueue.ts — Motor de ejecución de campañas con BullMQ
//
// ¿Por qué BullMQ y no simplemente un loop con setTimeout?
// 1. Si el servidor se reinicia, los jobs pendientes NO se pierden
//    (BullMQ los guarda en Redis)
// 2. Podemos pausar/reanudar campañas sin perder el progreso
// 3. Reintentos automáticos si falla el envío
// 4. Concurrencia controlada (no enviamos a 100 personas al mismo tiempo)
//
// FLUJO:
// crear campaña → agregar jobs a la cola → worker procesa uno por uno
// → typing → delay → enviar → actualizar DB → siguiente

import { Queue, Worker, Job } from "bullmq";
import { prisma } from "./prisma";
import {
  sendMessageWithTyping,
  calcTypingDelay,
  calcInterMessageDelay,
  formatWhatsappJid,
  sleep,
} from "./evolution";
import { MessageStatus } from "@prisma/client";

// Conexión a Redis — BullMQ la necesita para persistir los jobs
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redisUrlParsed = new URL(redisUrl);
const redisConnection = {
  host: redisUrlParsed.hostname,
  port: parseInt(redisUrlParsed.port ?? "6379"),
};

// ── Tipos del job ─────────────────────────────────────────────────────────────

export type CampaignJobData = {
  campaignId: string;
  messageLogId: string;  // ID del MessageLog en BD
  instanceName: string;  // nombre de la instancia Evolution
  phone: string;         // número del contacto
  text: string;          // texto del mensaje
};

// ── Cola de campañas ──────────────────────────────────────────────────────────

// La cola se crea una vez y se reutiliza
// "campaign-messages" es el nombre de la cola en Redis
export const campaignQueue = new Queue<CampaignJobData>("campaign-messages", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,           // reintentar 3 veces si falla
    backoff: {
      type: "exponential", // esperar 2s, 4s, 8s entre reintentos
      delay: 2000,
    },
    removeOnComplete: 100, // guardar solo los últimos 100 jobs completados
    removeOnFail: 500,     // guardar los últimos 500 fallidos para auditoría
  },
});

// ── Worker — el que procesa los jobs ──────────────────────────────────────────

// El worker corre en background y procesa un job a la vez (concurrency: 1)
// Así garantizamos que los mensajes se envían en orden y con delay

let worker: Worker | null = null;

export function startCampaignWorker() {
  if (worker) return; // ya está corriendo

  worker = new Worker<CampaignJobData>(
    "campaign-messages",
    async (job: Job<CampaignJobData>) => {
      const { campaignId, messageLogId, instanceName, phone } = job.data;
      // Leer el texto personalizado del MessageLog
      const msgLog = await prisma.messageLog.findUnique({ where: { id: messageLogId } });
      const text = msgLog?.messageText ?? job.data.text ?? "";

      try {
        // Verificar que la campaña no fue pausada mientras esperaba
        const campaign = await prisma.campaign.findUnique({
          where: { id: campaignId },
          select: { status: true },
        });

        if (campaign?.status === "PAUSED") {
          // Devolver el job a la cola para procesarlo después
          throw new Error("CAMPAIGN_PAUSED");
        }

        if (campaign?.status !== "RUNNING") {
          // Campaña cancelada o completada — ignorar
          return;
        }

        // Calcular el delay de typing según el largo del mensaje
        const typingDelay = calcTypingDelay(text);

        // Enviar con typing simulado
        const result = await sendMessageWithTyping(
          instanceName,
          formatWhatsappJid(phone),
          text,
          typingDelay
        );

        // Actualizar el MessageLog en BD como enviado
        await prisma.messageLog.update({
          where: { id: messageLogId },
          data: {
            status: MessageStatus.SENT,
            sentAt: new Date(),
          },
        });

        // Crear conversación en inbox si no existe
        const msgLog = await prisma.messageLog.findUnique({
          where: { id: messageLogId },
          include: { contact: true },
        });
        if (msgLog) {
          let conversacion = await prisma.conversation.findFirst({
            where: { contactId: msgLog.contactId, numberId: msgLog.numberId, isOpen: true },
          });
          if (!conversacion) {
            const num = await prisma.whatsappNumber.findUnique({ where: { id: msgLog.numberId } });
            conversacion = await prisma.conversation.create({
              data: {
                contactId: msgLog.contactId,
                numberId: msgLog.numberId,
                department: num?.department ?? "COBRANZA",
                agentId: (await prisma.campaign.findUnique({ where: { id: campaignId }, select: { agentId: true } }))?.agentId ?? "",
                isOpen: true,
              },
            });
          }
          await prisma.message.create({
            data: {
              conversationId: conversacion.id,
              content: text,
              fromContact: false,
              status: MessageStatus.SENT,
              sentAt: new Date(),
            },
          });
          await prisma.conversation.update({
            where: { id: conversacion.id },
            data: { updatedAt: new Date() },
          });
        }

        // Delay entre mensajes — esperar entre 3 y 8 segundos
        // antes de procesar el siguiente job
        const interDelay = calcInterMessageDelay();
        await sleep(interDelay);

        return result;

      } catch (error: unknown) {
        if (error instanceof Error && error.message === "CAMPAIGN_PAUSED") {
          // Re-lanzar para que BullMQ marque como failed y reintente
          throw error;
        }

        // Actualizar el MessageLog como fallido
        await prisma.messageLog.update({
          where: { id: messageLogId },
          data: {
            status: MessageStatus.FAILED,
            failReason: error instanceof Error ? error.message : "Error desconocido",
          },
        });

        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 1, // UN mensaje a la vez — crítico para el delay
    }
  );

  worker.on("completed", (job) => {
    console.log(`[Campaign] Job ${job.id} completado`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Campaign] Job ${job?.id} falló:`, err.message);
  });

  console.log("[Campaign] Worker iniciado");
}

// ── Funciones para gestionar campañas ────────────────────────────────────────

// Encolar todos los mensajes de una campaña
export async function enqueueCampaign(campaignId: string): Promise<void> {
  // Obtener la campaña con sus contactos y plantillas
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      number: true,
      templates: {
        include: { template: true },
        orderBy: { order: "asc" },
      },
      messageLogs: {
        include: { contact: true },
        where: { status: "PENDING" }, // solo los pendientes
      },
    },
  });

  if (!campaign) throw new Error("Campaña no encontrada");
  if (!campaign.number) throw new Error("Campaña sin número asignado");

  // Combinar el texto de todas las plantillas en orden
  const text = campaign.templates
    .map((ct) => ct.template.content)
    .join("\n\n");

  // Encolar un job por cada contacto pendiente
  const jobs = campaign.messageLogs.map((log) => ({
    name: `msg-${log.id}`,
    data: {
      campaignId,
      messageLogId: log.id,
      instanceName: campaign.number.label ?? campaign.number.number,
      phone: log.contact.phone,
      text,
    } as CampaignJobData,
  }));

  await campaignQueue.addBulk(jobs);

  // Actualizar estado de la campaña
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
    },
  });
}

// Pausar una campaña — los jobs en cola se detienen
export async function pauseCampaign(campaignId: string): Promise<void> {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "PAUSED" },
  });
  // Los jobs pendientes van a fallar con "CAMPAIGN_PAUSED"
  // y BullMQ los va a reintentar cuando la campaña se reanude
}

// Reanudar una campaña pausada
export async function resumeCampaign(campaignId: string): Promise<void> {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "RUNNING" },
  });
}
