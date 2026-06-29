/** @type {import('tailwindcss').Config} */
export default {

  content: [

    "./index.html",

    "./src/**/*.{js,ts,jsx,tsx}",

  ],

  theme: {

    extend: {

      // Cores neutras (zinc/white/black) resolvidas via variavel CSS,
      // pra permitir troca de tema (claro/escuro/azul corporativo) sem
      // tocar nas 460+ classes ja usadas em todo o app. Cores de
      // status/alerta/badge (green/red/yellow/blue/orange/purple) NAO
      // sao remapeadas — continuam fixas em qualquer tema.
      colors: {

        zinc: {
          50: "rgb(var(--zinc-50) / <alpha-value>)",
          100: "rgb(var(--zinc-100) / <alpha-value>)",
          200: "rgb(var(--zinc-200) / <alpha-value>)",
          300: "rgb(var(--zinc-300) / <alpha-value>)",
          400: "rgb(var(--zinc-400) / <alpha-value>)",
          500: "rgb(var(--zinc-500) / <alpha-value>)",
          600: "rgb(var(--zinc-600) / <alpha-value>)",
          700: "rgb(var(--zinc-700) / <alpha-value>)",
          800: "rgb(var(--zinc-800) / <alpha-value>)",
          900: "rgb(var(--zinc-900) / <alpha-value>)",
          950: "rgb(var(--zinc-950) / <alpha-value>)",
        },

        white: "rgb(var(--canvas-fg) / <alpha-value>)",

        black: "rgb(var(--canvas-bg) / <alpha-value>)",

      },

    },

  },

  plugins: [],

};
