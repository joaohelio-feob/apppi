"use client";

import { useEffect, useState } from "react";
import CartaoTarefa from "@/components/CartaoTarefa";
import { responsaveisDe, type Tarefa } from "@/lib/types";

const CHAVE_MINHAS = "pi-semana-somente-minhas";

export default function PainelSemana({
  atrasadas,
  daSemana,
  depois,
  meuId,
}: {
  atrasadas: Tarefa[];
  daSemana: Tarefa[];
  depois: Tarefa[];
  meuId: string | null;
}) {
  const [somenteMinhas, setSomenteMinhas] = useState(false);

  useEffect(() => {
    setSomenteMinhas(localStorage.getItem(CHAVE_MINHAS) === "1");
  }, []);

  function alternar() {
    setSomenteMinhas((atual) => {
      const novo = !atual;
      localStorage.setItem(CHAVE_MINHAS, novo ? "1" : "0");
      return novo;
    });
  }

  const filtrar = (lista: Tarefa[]) =>
    somenteMinhas ? lista.filter((t) => responsaveisDe(t).some((m) => m.id === meuId)) : lista;

  return (
    <div>
      <div className="flex justify-end">
        <button
          onClick={alternar}
          disabled={!meuId}
          className={`border px-3 py-2 font-mono text-xs uppercase disabled:opacity-40 ${
            somenteMinhas ? "border-tinta bg-tinta text-campo" : "border-linha text-tinta/70 hover:bg-casca"
          }`}
        >
          minhas tarefas
        </button>
      </div>

      <div className="mt-4 space-y-10">
        <Secao titulo="Passou do prazo" itens={filtrar(atrasadas)} vazio="Nada atrasado. Bom sinal." />
        <Secao titulo="Próximos 7 dias" itens={filtrar(daSemana)} vazio="A semana está livre — hora de puxar algo da fila." />
        <Secao titulo="Mais adiante" itens={filtrar(depois)} vazio="Sem tarefas na fila." />
      </div>
    </div>
  );
}

function Secao({ titulo, itens, vazio }: { titulo: string; itens: Tarefa[]; vazio: string }) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-2 border-b border-linha pb-1 font-display text-lg font-semibold">
        {titulo}
        <span className="font-mono text-xs font-normal text-tinta/50">{itens.length}</span>
      </h2>
      {itens.length === 0 ? (
        <p className="text-sm text-tinta/50">{vazio}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((t) => <CartaoTarefa key={t.id} tarefa={t} />)}
        </div>
      )}
    </section>
  );
}
