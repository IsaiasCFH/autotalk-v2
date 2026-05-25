// tailwind.config.ts — Configuración de Tailwind CSS
//
// Tailwind solo genera las clases que REALMENTE usas en el código.
// "content" le dice a qué archivos mirar para detectar clases usadas.
// Si no incluyes un archivo aquí, las clases de ese archivo no se generan.

import type { Config } from "tailwindcss";

const config: Config = {
  // darkMode: 'class' = el modo oscuro se activa con la clase "dark" en <html>
  // (que ya pusimos en layout.tsx)
  darkMode: "class",

  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      colors: {
        // Paleta base de AutoTalk — dark navy
        base: {
          DEFAULT: "#0a0a0f",
          surface: "#0d0d1a",
          elevated: "#13132a",
        },
      },
      // Animaciones custom registradas en globals.css
      animation: {
        "fade-in": "fadeIn 0.2s ease-out forwards",
        "slide-in-left": "slideInLeft 0.2s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },

  plugins: [],
};

export default config;
