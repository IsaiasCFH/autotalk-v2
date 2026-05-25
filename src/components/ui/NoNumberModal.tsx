"use client";
// components/ui/NoNumberModal.tsx — Modal de error: sin número conectado
//
// Se muestra cuando el agente intenta enviar un mensaje o campaña
// pero no hay ningún número conectado en su departamento.
// Tiene un botón directo para ir a conectar uno.

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  department?: string; // nombre del departamento para el mensaje
};

export function NoNumberModal({ isOpen, onClose, department }: Props) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    // Overlay — clic fuera cierra el modal
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Fondo oscuro semitransparente */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card del modal */}
      <div
        className="relative w-full max-w-sm bg-[#0d0d1a] border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()} // evitar que el clic en la card cierre el modal
      >
        {/* Ícono de error */}
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6 text-red-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3h3m-3 3h3" />
          </svg>
        </div>

        <h3 className="text-base font-semibold text-white text-center mb-2">
          Sin número conectado
        </h3>

        <p className="text-sm text-white/50 text-center mb-6">
          {department
            ? `No hay ningún número de WhatsApp conectado en ${department}. Conecta uno para poder enviar mensajes.`
            : "No hay ningún número de WhatsApp conectado. Conecta uno para poder enviar mensajes."}
        </p>

        <div className="flex flex-col gap-2">
          {/* Ir a conectar número */}
          <button
            onClick={() => {
              onClose();
              router.push("/numeros");
            }}
            className="w-full py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors border border-emerald-500/20"
          >
            Conectar número
          </button>

          {/* Cancelar */}
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white/5 text-white/50 text-sm font-medium hover:bg-white/8 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
