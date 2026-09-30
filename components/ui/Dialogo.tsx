"use client";

import { useEffect, useRef, type ReactNode, type KeyboardEvent } from "react";

let dialogosAbertos = 0;
let overflowOriginal = "";

export default function Dialogo({
  titulo,
  aoFechar,
  children,
  ocupado = false,
  classe = "dialogo",
  focoNoPainel = false,
}: {
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
  ocupado?: boolean;
  classe?: string;
  focoNoPainel?: boolean;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const origem = document.activeElement as HTMLElement | null;
    if (dialogosAbertos === 0) {
      overflowOriginal = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    dialogosAbertos += 1;
    const elemento = dialogo.current;
    elemento?.showModal();
    if (focoNoPainel) elemento?.focus();
    return () => {
      elemento?.close();
      dialogosAbertos -= 1;
      if (dialogosAbertos === 0)
        document.body.style.overflow = overflowOriginal;
      if (origem?.isConnected) origem.focus();
      else document.getElementById("conteudo")?.focus();
    };
  }, [focoNoPainel]);
  function aoTeclar(e: KeyboardEvent<HTMLDialogElement>) {
    e.stopPropagation();
    if (e.key !== "Tab") return;
    const alvos = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
      ),
    ).filter((alvo) => alvo.getClientRects().length > 0);
    const primeiro = alvos[0];
    const ultimo = alvos[alvos.length - 1];
    if (
      e.shiftKey &&
      (document.activeElement === primeiro ||
        document.activeElement === e.currentTarget)
    ) {
      e.preventDefault();
      ultimo?.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro?.focus();
    }
  }
  return (
    <dialog
      onKeyDown={aoTeclar}
      ref={dialogo}
      tabIndex={-1}
      aria-label={titulo}
      aria-busy={ocupado}
      onCancel={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!ocupado) aoFechar();
      }}
      className={classe}
    >
      {children}
    </dialog>
  );
}
