import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        campo:  "#F1F4EE", // fundo
        casca:  "#E3E8DD", // superfície
        linha:  "#CBD3C2", // divisórias
        tinta:  "#10231A", // texto principal
        musgo:  "#2F5D45", // verde de apoio
        broto:  "#7CB518", // sinal / ação
        trigo:  "#D98E04", // atenção / prazo
        ferro:  "#3F6E8C", // revisão
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        corpo:   ["var(--font-corpo)", "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { none: "0", sm: "2px", DEFAULT: "3px" },
    },
  },
  plugins: [],
};
export default config;
