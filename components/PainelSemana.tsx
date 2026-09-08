"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CartaoTarefa from "@/components/CartaoTarefa";
import LinhaTarefa from "@/components/LinhaTarefa";
import { responsaveisDe, type Tarefa } from "@/lib/types";

const CHAVE_MINHAS = "pi-semana-somente-minhas";

/**
 * Peso proporcional à urgência: o que passou do prazo é cartão, o resto é
 * linha de caderno. Quatro itens tranquilos não precisam de quatro caixas
 * do mesmo peso do item atrasado.
 */
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
  const router = useRouter();

  // O estado vive aqui e no localStorage, nunca derivado das props: o
  // aoAtualizar dá router.refresh(), que troca as props e manteria este
  // componente montado — mas se um dia ele remontar, o localStorage
  // recupera. Mesma precaução do "ver mais N" no quadro.
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

  const atualizar = () => router.refresh();

  const vencidas = filtrar(atrasadas);
  const semana = filtrar(daSemana);
  const adiante = filtrar(depois);

  return (
    <div className="space-y-8">
      {/* ---------- passou do prazo: o único bloco em caixa ---------- */}
      <section aria-labelledby="sec-atraso">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 id="sec-atraso" className="font-display text-lg font-semibold">
            {vencidas.length === 0
              ? "nada passou do prazo"
              : `${vencidas.length} ${vencidas.length === 1 ? "passou" : "passaram"} do prazo`}
          </h2>
          <button
            onClick={alternar}
            disabled={!meuId}
            aria-pressed={somenteMinhas}
            className={`border px-3 py-1.5 text-xs transition-colors duration-micro ease-entrada disabled:opacity-40 ${
              somenteMinhas
                ? "border-tinta bg-tinta text-campo"
                : "border-linha text-tinta/70 hover:bg-casca hover:text-tinta"
            }`}
          >
            {somenteMinhas ? "só as minhas" : "todas da equipe"}
          </button>
        </div>

        {/* Sem itens, a própria manchete já diz tudo — nenhum bloco vazio
            sobrando embaixo dela. */}
        {vencidas.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {vencidas.map((t) => (
              <CartaoTarefa key={t.id} tarefa={t} aoAtualizar={atualizar} />
            ))}
          </div>
        )}
      </section>

      <Fila titulo="próximos 7 dias" itens={semana} vazio="a semana está livre." aoAtualizar={atualizar} />
      <Fila titulo="mais adiante" itens={adiante} vazio="sem tarefas na fila." aoAtualizar={atualizar} />
    </div>
  );
}

function Fila({
  titulo,
  itens,
  vazio,
  aoAtualizar,
}: {
  titulo: string;
  itens: Tarefa[];
  vazio: string;
  aoAtualizar: () => void;
}) {
  const id = `sec-${titulo.replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id}>
      {/* Contagem inline no texto, não badge à parte. A régua para no texto. */}
      <h2 id={id} className="mb-1 inline-block border-b-2 border-tinta pb-1 font-display text-lg font-semibold">
        {titulo}
        {itens.length > 0 && (
          <span className="ml-2 font-mono text-xs font-normal text-tinta/70">· {itens.length}</span>
        )}
      </h2>

      {itens.length === 0 ? (
        <p className="mt-2 text-sm text-tinta/70">{vazio}</p>
      ) : (
        <div className="mt-1 border-t border-linha">
          {itens.map((t) => (
            <LinhaTarefa key={t.id} tarefa={t} aoAtualizar={aoAtualizar} />
          ))}
        </div>
      )}
    </section>
  );
}
