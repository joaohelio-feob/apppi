"use client";

import Botao from "@/components/ui/Botao";
import { IconeAlerta } from "@/components/ui/Icones";

export default function ErroPagina({ reset }: { reset: () => void }) {
  return (
    <section
      role="alert"
      className="cartao border-l-4 border-l-trigo p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-trigo/20 text-tinta">
          <IconeAlerta className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold text-tinta">
            Não foi possível abrir esta página.
          </h1>
          <p className="my-2 text-sm text-tinta/70">
            Verifique sua conexão e tente novamente para carregar os dados do
            painel.
          </p>
          <Botao variante="primario" className="mt-2" onClick={reset}>
            Tentar novamente
          </Botao>
        </div>
      </div>
    </section>
  );
}
