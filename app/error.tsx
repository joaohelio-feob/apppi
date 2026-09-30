"use client";

import Botao from "@/components/ui/Botao";

export default function ErroPagina({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="border-l-2 border-trigo pl-4">
      <h1 className="font-display text-xl font-semibold">
        Não foi possível abrir esta página.
      </h1>
      <p className="my-3 text-sm text-tinta/70">
        Tente novamente para carregar os dados.
      </p>
      <Botao onClick={reset}>Tentar novamente</Botao>
    </section>
  );
}
