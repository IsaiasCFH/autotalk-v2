# AutoTalk — Setup

## Requisitos
- Node.js 18+
- Docker (para PostgreSQL + Redis)
- npm

---

## 1. Levantar la base de datos

```bash
docker compose up postgres redis -d
```

---

## 2. Instalar dependencias

```bash
npm install
```

---

## 3. Variables de entorno

El `.env` ya está configurado. Verifica que `DATABASE_URL` apunte al postgres correcto:

```
DATABASE_URL="postgresql://autotalk:autotalk_secret@localhost:5433/autotalk"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_SECRET="genera_uno_con: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
OPENAI_API_KEY=""
```

Genera el `NEXTAUTH_SECRET` con:
```bash
openssl rand -base64 32
```

---

## 4. Aplicar migraciones a la BD

```bash
npm run db:migrate
```
> Nombre sugerido para la migración: `init`

---

## 5. Poblar con datos iniciales (seed)

```bash
npm run db:seed
```

Esto crea:
- **Admin:** admin@autotalk.com / autotalk123
- **Cobranza:** cobranza@autotalk.com / autotalk123
- **Selección:** seleccion@autotalk.com / autotalk123
- **Ventas:** ventas@autotalk.com / autotalk123

---

## 6. Correr el servidor de desarrollo

```bash
npm run dev
```

Ir a `http://localhost:3000` → redirige al login.

---

## Estructura del proyecto

```
src/
├── app/
│   ├── api/auth/[...nextauth]/   → NextAuth handler
│   ├── login/                    → Página de login
│   ├── inbox/                    → Inbox de conversaciones
│   ├── campanias/                → Campañas masivas
│   ├── contactos/                → Gestión de contactos
│   ├── numeros/                  → Números WhatsApp + QR
│   └── compromisos/              → Compromisos de pago
├── components/
│   ├── layout/                   → Sidebar, AppLayout
│   ├── ui/                       → Botones, inputs, badges
│   ├── chat/                     → Componentes del chat
│   └── campaigns/                → Componentes de campañas
├── lib/
│   ├── prisma.ts                 → Cliente Prisma singleton
│   ├── auth.ts                   → Configuración NextAuth
│   └── utils.ts                  → cn(), formatPhone(), etc.
├── store/
│   └── useAppStore.ts            → Estado global UI (Zustand)
├── types/
│   └── index.ts                  → Tipos TypeScript globales
└── middleware.ts                 → Protección de rutas
```

---

## Comandos útiles

```bash
npm run db:migrate    # Aplicar migraciones pendientes
npm run db:studio     # Abrir Prisma Studio (UI para la BD)
npm run db:seed       # Poblar con datos de ejemplo
npm run db:reset      # PELIGRO: resetea toda la BD
```
