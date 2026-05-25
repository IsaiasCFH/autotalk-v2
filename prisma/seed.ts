// prisma/seed.ts — Datos iniciales de la BD
//
// Crea un agente ADMIN para poder entrar a la app.
// Ejecutar con: npm run db:seed
//
// ¿Por qué no hacerlo a mano en la BD?
// El seed es reproducible, documentado y versionado con git.
// Cualquier dev que clone el repo puede tener datos de prueba
// con un solo comando.

import { PrismaClient, Role, Department } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...");

  // Hashear la contraseña — NUNCA guardar plain text
  // bcrypt.hash(password, saltRounds)
  // saltRounds: 12 es seguro para producción (más alto = más lento = más seguro)
  const hashedPassword = await bcrypt.hash("autotalk123", 12);

  // upsert = "insert or update"
  // Si el agente ya existe (por email), lo actualiza
  // Si no existe, lo crea
  // Así el seed es idempotente (se puede ejecutar múltiples veces sin romper nada)
  const admin = await prisma.agent.upsert({
    where: { email: "admin@autotalk.com" },
    update: {},
    create: {
      email: "admin@autotalk.com",
      password: hashedPassword,
      name: "Admin AutoTalk",
      role: Role.ADMIN,
      departments: [
        Department.COBRANZA,
        Department.SELECCION,
        Department.CONTABILIDAD,
        Department.VENTAS,
        Department.CSX,
      ],
      isActive: true,
    },
  });

  console.log(`✅ Admin creado: ${admin.email}`);

  // Agentes de ejemplo por departamento
  const agentes = [
    { email: "cobranza@autotalk.com", name: "Ana Cobranza", dept: Department.COBRANZA },
    { email: "seleccion@autotalk.com", name: "Pedro Selección", dept: Department.SELECCION },
    { email: "ventas@autotalk.com", name: "María Ventas", dept: Department.VENTAS },
  ];

  for (const agente of agentes) {
    const pw = await bcrypt.hash("autotalk123", 12);
    await prisma.agent.upsert({
      where: { email: agente.email },
      update: {},
      create: {
        email: agente.email,
        password: pw,
        name: agente.name,
        role: Role.AGENT,
        departments: [agente.dept],
        isActive: true,
      },
    });
    console.log(`✅ Agente creado: ${agente.email}`);
  }

  console.log("\n🎉 Seed completado!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📧 Admin:    admin@autotalk.com");
  console.log("🔑 Password: autotalk123");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("⚠️  Cambia la contraseña en producción!");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
