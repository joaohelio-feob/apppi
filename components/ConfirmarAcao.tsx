"use client";

import { useEffect, useRef } from "react";

/**
 * Confirmação de ação, no lugar de `window.confirm()`.
 *
 * O `confirm` nativo não aceita os tokens do tema, não é anunciado como
 * diálogo e — o que mais importa aqui — só cabe uma frase, então acaba
 * dizendo "tem certeza?" em vez de dizer o que vai acontecer.
 *
 * Arquivar é reversível, então isto é uma confirmação leve, não um alarme:
 * diz o que acontece, para onde a coisa vai e que dá para voltar. Nada de
 * vermelho, nada de "atenção".
 */
export default function ConfirmarAcao({
  titulo,
  descricao,
  rotuloConfirmar,
  executando,
  aoConfirmar,
  aoCancelar,
}: {
  titulo: string;
  /** O que acontece, para onde vai, e se dá para desfazer. */
  descricao: React.ReactNode;
  rotuloConfirmar: string;
  executando?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  const painel = useRef<HTMLDivElement>(null);
  const confirmar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const abriuDaqui = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmar.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      abriuDaqui?.focus?.();
    };
  }, []);

  function aoTeclar(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      aoCancelar();
      return;
    }
    if (e.key !== "Tab" || !painel.current) return;
    const alvos = Array.from(
      painel.current.querySelectorAll<HTMLElement>("button:not([disabled])")
    );
    if (alvos.length === 0) return;
    const primeiro = alvos[0];
    const ultimo = alvos[alvos.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-tinta/40 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoCancelar();
      }}
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmar-titulo"
        onKeyDown={aoTeclar}
        className="w-full max-w-md border border-linha bg-campo p-5"
      >
        <h2 id="confirmar-titulo" className="font-display text-lg font-semibold">
          {titulo}
        </h2>
        <div className="mt-2 text-sm text-tinta/70">{descricao}</div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            ref={confirmar}
            onClick={aoConfirmar}
            disabled={executando}
            className="bg-tinta px-4 py-2 text-sm font-semibold text-campo transition-opacity duration-150 hover:bg-musgo disabled:opacity-50"
          >
            {executando ? "…" : rotuloConfirmar}
          </button>
          <button
            onClick={aoCancelar}
            disabled={executando}
            className="border border-linha px-4 py-2 text-sm transition-opacity duration-150 hover:bg-casca disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
