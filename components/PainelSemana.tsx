"use client";

import { useAtualizacaoTarefas } from "@/lib/useAtualizacaoTarefas";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Botao from "./ui/Botao";
import { useNovaTarefa } from "./NovaTarefaProvider";
import LinhaTarefa from "@/components/LinhaTarefa";
import { responsaveisDe, type Tarefa } from "@/lib/types";

const CHAVE_MINHAS = "pi-semana-somente-minhas";

export default function PainelSemana({
  atrasadas,
  daSemana,
  depois,
  meuId,
  revisoesPendentes,
  erroRevisoes,
}: {
  atrasadas: Tarefa[];
  daSemana: Tarefa[];
  depois: Tarefa[];
  meuId: string | null;
  revisoesPendentes: Tarefa[];
  erroRevisoes: boolean;
}) {
  const { abrir } = useNovaTarefa();
  const [somenteMinhas, setSomenteMinhas] = useState(false);
  const router = useRouter();
  useAtualizacaoTarefas("semana", () => router.refresh());

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
    somenteMinhas
      ? lista.filter((t) => responsaveisDe(t).some((m) => m.id === meuId))
      : lista;

  const atualizar = () => router.refresh();

  const vencidas = filtrar(atrasadas);
  const semana = filtrar(daSemana).filter((t) => t.status !== "revisao");
  const adiante = filtrar(depois).filter((t) => t.status !== "revisao");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha pb-3">
        <div className="flex gap-1" aria-label="Responsáveis pelas tarefas">
          <Botao
            variante={somenteMinhas ? "primario" : "discreto"}
            disabled={!meuId}
            aria-pressed={somenteMinhas}
            onClick={() => {
              if (!somenteMinhas) alternar();
            }}
          >
            Minhas tarefas
          </Botao>
          <Botao
            variante={!somenteMinhas ? "primario" : "discreto"}
            aria-pressed={!somenteMinhas}
            onClick={() => {
              if (somenteMinhas) alternar();
            }}
          >
            Equipe
          </Botao>
        </div>
        <Botao onClick={abrir}>
          + Nova tarefa <kbd className="font-mono text-xs">N</kbd>
        </Botao>
      </div>
      <section aria-labelledby="sec-atraso">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 id="sec-atraso" className="font-display text-lg font-semibold">
            {vencidas.length === 0
              ? "nada passou do prazo"
              : `${vencidas.length} ${vencidas.length === 1 ? "passou" : "passaram"} do prazo`}
          </h2>
        </div>

        {/* Sem itens, a própria manchete já diz tudo — nenhum bloco vazio
            sobrando embaixo dela. */}
        {vencidas.length > 0 && (
          <div className="border-l-2 border-trigo bg-casca/40 pl-2">
            {vencidas.map((t) => (
              <LinhaTarefa key={t.id} tarefa={t} aoAtualizar={atualizar} />
            ))}
          </div>
        )}
      </section>

      {erroRevisoes ? (
        <p role="alert" className="text-sm">
          Não foi possível consultar as revisões pendentes.
        </p>
      ) : (
        <Fila
          titulo="Em revisão"
          itens={
            somenteMinhas
              ? revisoesPendentes.filter(
                  (t) =>
                    t.revisor_id === meuId ||
                    responsaveisDe(t).some((m) => m.id === meuId),
                )
              : revisoesPendentes
          }
          vazio="Nenhuma tarefa em revisão."
          aoAtualizar={atualizar}
        />
      )}
      <Fila
        titulo="Próximos 7 dias"
        itens={semana}
        vazio="a semana está livre."
        aoAtualizar={atualizar}
      />
      <Fila
        titulo="Mais adiante"
        itens={adiante}
        vazio="sem tarefas na fila."
        aoAtualizar={atualizar}
      />
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
      <h2
        id={id}
        className="mb-1 inline-block border-b-2 border-tinta pb-1 font-display text-lg font-semibold"
      >
        {titulo}
        {itens.length > 0 && (
          <span className="ml-2 font-mono text-xs font-normal text-tinta/70">
            · {itens.length}
          </span>
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
