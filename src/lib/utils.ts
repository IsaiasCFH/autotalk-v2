// lib/utils.ts — Utilidades globales
//
// cn() es LA función más usada en proyectos con Tailwind.
// Combina clsx + tailwind-merge:
//
// clsx → une clases condicionalmente:
//   clsx('px-4', isActive && 'bg-blue-500') → "px-4 bg-blue-500"
//
// tailwind-merge → resuelve conflictos de clases Tailwind:
//   sin merge: "px-4 px-6" → ambas quedan (bug visual)
//   con merge:  "px-4 px-6" → queda solo "px-6" (la última gana)
//
// Ejemplo de uso:
//   cn('px-4 text-sm', isActive ? 'bg-green-500' : 'bg-gray-200')

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formatea un número de teléfono para mostrar
// "56912345678" → "+56 9 1234 5678"
export function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.startsWith("56") && clean.length === 11) {
    return `+56 ${clean[2]} ${clean.slice(3, 7)} ${clean.slice(7)}`;
  }
  return `+${clean}`;
}

// Formatea fecha relativa simple
// "hace 5 minutos", "hace 2 horas", etc.
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < 60) return "ahora";
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)}h`;
  return `hace ${Math.floor(seconds / 86400)}d`;
}

// Obtiene las iniciales de un nombre para avatares
// "Juan Pérez" → "JP"
export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}
