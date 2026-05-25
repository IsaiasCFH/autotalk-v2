// app/api/auth/[...nextauth]/route.ts
//
// [...nextauth] = "catch-all route" en Next.js App Router
// Captura TODAS las rutas bajo /api/auth/:
//   /api/auth/signin
//   /api/auth/signout
//   /api/auth/session
//   /api/auth/callback/credentials
// etc.
//
// NextAuth maneja todas esas rutas automáticamente.
// Nosotros solo le pasamos nuestra config (authOptions) y listo.

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

// En Next.js App Router, las API routes exportan GET y POST
// NextAuth necesita ambos (GET para session/csrf, POST para login/logout)
export { handler as GET, handler as POST };
