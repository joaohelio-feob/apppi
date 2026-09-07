import type { Config } from "tailwindcss";

const config: Config = {
  // lib/ precisa estar aqui: CLASSES_PRIORIDADE e CLASSES_COR_FRENTE
  // (lib/types.ts) guardam classes inteiras como texto, e o Tailwind só gera
  // CSS pra classe que aparece literalmente num arquivo escaneado. Sem esta
  // linha, "border-l-4", "border-broto", "text-broto", "bg-broto" e
  // "border-ferro" não existiam em nenhum arquivo de app/ ou components/ —
  // ou seja, a borda esquerda de prioridade do calendário e a cor das
  // frentes "broto"/"ferro" simplesmente não renderizavam.
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
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

      // ---- Movimento: os tokens vivem só aqui ----------------------------
      // "Adicionar fluidez" sem sistema produz três telas com três durações.
      // Só existem estes dois tempos e estes dois easings; 240ms é teto
      // absoluto e nada pode passar disso.
      //
      // E só se anima `opacity` e `transform`. Propriedade de layout (height,
      // width, top, margin, padding) força reflow, produz jank e é o oposto do
      // que se quer — nunca use `transition-all` nem `transition-[height]`.
      transitionDuration: {
        micro: "120ms",   // hover, foco, toggle — resposta a um dedo
        entrada: "180ms", // um elemento entrando ou saindo da tela
      },
      transitionTimingFunction: {
        // Desacelera ao chegar: o elemento "assenta" no lugar.
        entrada: "cubic-bezier(0.16, 1, 0.3, 1)",
        // Acelera ao sair: some rápido, sem pedir atenção.
        saida: "cubic-bezier(0.4, 0, 1, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
