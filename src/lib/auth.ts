// lib/auth.ts — Configuración central de NextAuth
//
// NextAuth maneja toda la autenticación: login, sesiones, tokens.
// Usamos "Credentials Provider" porque tenemos nuestra propia BD
// (en vez de Google/GitHub OAuth).
//
// FLUJO:
// 1. Usuario escribe email + password en /login
// 2. NextAuth llama a authorize() con esos datos
// 3. authorize() busca el agente en la BD y verifica la contraseña
// 4. Si ok → devuelve el objeto user → NextAuth crea la sesión
// 5. callbacks.jwt → mete datos extra (role, departments) en el token JWT
// 6. callbacks.session → expone esos datos al frontend

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { Department, Role } from "@prisma/client";

// Extendemos los tipos de NextAuth para incluir nuestros campos custom
// Sin esto TypeScript no sabe que session.user tiene `role` y `departments`
declare module "next-auth" {
  interface User {
    id: string;
    role: Role;
    departments: Department[];
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      departments: Department[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    departments: Department[];
  }
}

export const authOptions: NextAuthOptions = {
  // Las sesiones en NextAuth pueden ser "jwt" o "database"
  // jwt = el token viaja en una cookie cifrada (sin hits a BD en cada request)
  // database = guarda sesiones en BD (más control, más queries)
  // Usamos jwt porque es más rápido y suficiente para nuestro caso
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas — una jornada laboral
  },

  pages: {
    signIn: "/login", // redirige aquí si no está autenticado
  },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Busca el agente en la BD
        const agent = await prisma.agent.findUnique({
          where: { email: credentials.email },
        });

        if (!agent || !agent.isActive) return null;

        // bcrypt.compare() verifica la contraseña sin desencriptarla
        // (las contraseñas hasheadas son de un solo sentido — no se pueden revertir)
        const isValid = await bcrypt.compare(
          credentials.password,
          agent.password
        );

        if (!isValid) return null;

        return {
          id: agent.id,
          email: agent.email,
          name: agent.name,
          role: agent.role,
          departments: agent.departments,
        };
      },
    }),
  ],

  callbacks: {
    // jwt() se llama cada vez que se crea o verifica el token
    // Aquí metemos los datos extras que queremos en el token
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.departments = user.departments;
      }
      return token;
    },

    // session() se llama cada vez que el frontend pide la sesión
    // Copiamos los datos del token → session para que el frontend los vea
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.departments = token.departments;
      return session;
    },
  },
};
