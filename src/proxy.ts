// middleware.ts — Protección de rutas a nivel de servidor
//
// ¿Por qué middleware y no verificar en cada página?
// El middleware corre ANTES de que se cargue cualquier página.
// Si proteges dentro de la página, el HTML se empieza a renderizar
// antes de saber si el usuario tiene acceso → parpadeo de UI.
// Con middleware, la redirección ocurre en el Edge (rapidísimo).
//
// FLUJO:
// Request → middleware.ts → ¿tiene sesión? → sí → página
//                                           → no → /login

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { Department } from "@prisma/client";

// withAuth() es un wrapper de NextAuth que añade `token` al request
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const role = token.role as string;
    const departments = token.departments as Department[];

    // SUPERADMIN y ADMIN pueden acceder a todo
    if (role === "ADMIN") {
      // ADMIN no puede acceder a /configuracion (solo SUPERADMIN)
      // Por ahora tratamos ADMIN como acceso completo excepto config futura
      return NextResponse.next();
    }

    // Agentes de departamentos específicos
    // Solo pueden ver sus secciones — el resto devuelve 403
    const deptRoutes: Record<string, Department[]> = {
      "/inbox/cobranza": ["COBRANZA"],
      "/inbox/seleccion": ["SELECCION"],
      "/inbox/contabilidad": ["CONTABILIDAD"],
      "/inbox/ventas": ["VENTAS"],
      "/inbox/csx": ["CSX"],
    };

    for (const [route, allowedDepts] of Object.entries(deptRoutes)) {
      if (pathname.startsWith(route)) {
        const hasAccess = allowedDepts.some((d) => departments.includes(d));
        if (!hasAccess) {
          // Redirige al primer departamento que tiene acceso
          const firstDept = departments[0]?.toLowerCase();
          if (firstDept) {
            return NextResponse.redirect(
              new URL(`/inbox/${firstDept}`, req.url)
            );
          }
          return NextResponse.redirect(new URL("/inbox", req.url));
        }
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // authorized() decide si el middleware siquiera corre
      // false → NextAuth redirige automáticamente a /login
      authorized: ({ token }) => !!token,
    },
  }
);

// matcher define QUÉ rutas protege el middleware
// Las rutas en este array requieren autenticación
// /login y /api/auth quedan FUERA (son públicas)
export const config = {
  matcher: [
    "/inbox/:path*",
    "/campanias/:path*",
    "/contactos/:path*",
    "/numeros/:path*",
    "/compromisos/:path*",
    "/dashboard/:path*",
    "/configuracion/:path*",
    "/agentes/:path*",
    "/contactos/:path*",
  ],
};
