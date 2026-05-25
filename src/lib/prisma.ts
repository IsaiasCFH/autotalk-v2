// lib/prisma.ts — Cliente de Prisma como Singleton
//
// ¿Por qué singleton? En desarrollo, Next.js recarga el servidor
// con cada cambio de archivo (hot reload). Sin este patrón,
// cada recarga crearía una nueva conexión a PostgreSQL.
// Con 10 recargas tendrías 10 conexiones abiertas → PostgreSQL explota.
//
// La solución: guardamos la instancia en `global` (que NO se resetea
// con hot reload) y la reutilizamos siempre.

import { PrismaClient } from "@prisma/client";

// Extendemos el tipo global de Node.js para que TypeScript
// sepa que existe esta propiedad (si no, da error de tipos)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"] // en dev: vemos todas las queries en consola
        : ["error"], // en producción: solo errores
  });

// Solo guardamos en global si estamos en desarrollo
// En producción cada instancia de servidor tiene su propio proceso
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
