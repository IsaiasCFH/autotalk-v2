// app/layout.tsx — Layout raíz de toda la app
//
// En Next.js App Router, layout.tsx envuelve TODAS las páginas.
// Este es el único lugar donde ponemos <html> y <body>.
//
// SessionProvider de NextAuth necesita estar aquí porque
// expone la sesión a todos los componentes hijo via React Context.
// Como es un Client Component (usa hooks internamente),
// lo separamos en un wrapper para no marcar este archivo como "use client"
// (los layouts raíz deben ser Server Components cuando se puede).

import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AutoTalk", template: "%s | AutoTalk" },
  description: "Plataforma de mensajería WhatsApp empresarial",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="bg-[#0a0a0f] text-white antialiased">
        <Providers>
          {children}
          {/* Sonner — librería de toast notifications (mucho mejor que alert()) */}
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              style: {
                background: "#1a1a2e",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
