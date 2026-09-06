"use client";

import { useState } from "react";
import { dataLocalISO, diasEntre, estaAtrasada } from "@/lib/datas";
import { progressoCriterios } from "@/lib/criterios";
import {
  CLASSES_PRIORIDADE, PRIORIDADES, STATUS, responsaveisDe,
  type Frente, type Membro, type Tarefa,
} from "@/lib/types";
import DetalheTarefa from "./DetalheTarefa";

/**
 * Uma tarefa como linha de caderno, para filas onde o cartão pesa demais:
 * quatro itens tranquilos não precisam de quatro caixas iguais. O cartão
 * (CartaoTarefa) continua sendo o tratamento do que é urgente.
 *
 * Mesma gramática de sinais do cartão e do calendário: prioridade é forma
 * (glifo), atraso soma "!" por cima. Nada aqui depende de cor para ser lido.
 */
export default function LinhaTarefa({
  tarefa,
  aoAtualizar,
  membros,
  frentes,
}: {
  tarefa: Tarefa;
  aoAtualizar?: () => void;
  membros?: Membro[];
  frentes?: Frente[];
}) {
  const [aberto, setAberto] = useState(false);

  const hoje = dataLocalISO();
  const atrasada = estaAtrasada(tarefa.status, tarefa.prazo, hoje);
  const prio = CLASSES_PRIORIDADE[tarefa.prioridade];
  const nomePrio = PRIORIDADES.find((p) => p.id === tarefa.prioridade)?.nome ?? tarefa.prioridade;
  const nomeStatus = STATUS.find((s) => s.id === tarefa.status)?.nome ?? tarefa.status;
  const responsaveis = responsaveisDe(tarefa);
  const progresso = progressoCriterios(tarefa.descricao);

  const nomes = responsaveis.map((m) => m.nome);
  // Duas pessoas por extenso; a partir daí, a primeira e o resto contado.
  const quem =
    nomes.length === 0 ? "sem dono"
    : nomes.length <= 2 ? nomes.join(" e ")
    : `${nomes[0]} +${nomes.length - 1}`;

  const dias = tarefa.prazo ? diasEntre(tarefa.prazo, hoje) : null;
  const prazoCurto =
    dias === null ? "—"
    : atrasada ? `${Math.abs(dias)}d`
    : dias === 0 ? "hoje"
    : `${dias}d`;

  const rotulo =
    `${tarefa.titulo} · ${nomeStatus} · prioridade ${nomePrio}` +
    `${atrasada ? " · atrasada" : ""} · ${quem}` +
    `${tarefa.frentes ? ` · frente ${tarefa.frentes.nome}` : ""}` +
    `${tarefa.prazo ? ` · ${atrasada ? `${Math.abs(dias!)} dias de atraso` : dias === 0 ? "vence hoje" : `faltam ${dias} dias`}` : ""}` +
    `${progresso ? ` · ${progresso.feitos} de ${progresso.total} critérios` : ""}` +
    " · abrir detalhes";

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={rotulo}
        className="grid w-full grid-cols-[1.1rem_minmax(0,1fr)_auto] items-baseline gap-x-2 border-b border-linha py-2 text-left transition duration-150 hover:bg-casca focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-musgo sm:grid-cols-[1.1rem_minmax(0,1fr)_minmax(0,17rem)_auto]"
      >
        <span aria-hidden="true" className="font-mono text-xs text-tinta/70">
          {atrasada ? <span className="font-semibold text-trigo">!</span> : prio.glifo}
        </span>

        <span className="min-w-0 truncate text-sm">{tarefa.titulo}</span>

        {/* Metadados na mesma linha, não numa segunda: é o que mantém a linha
            com altura de linha. Abaixo de sm eles somem — largura ali é para
            o título. "frente" escrito por extenso é o que distingue pessoa de
            frente sem depender de cor nem de conhecer os nomes do time. */}
        <span className="hidden min-w-0 truncate text-xs text-tinta/70 sm:block">
          {quem}
          {tarefa.frentes && <> · frente {tarefa.frentes.nome}</>}
          {progresso && (
            <>
              {" · "}
              <span className="font-mono">{progresso.feitos}/{progresso.total}</span>
            </>
          )}
        </span>

        <span
          className={`shrink-0 font-mono text-xs tabular-nums ${
            atrasada ? "font-semibold text-trigo" : "text-tinta/70"
          }`}
        >
          {prazoCurto}
        </span>
      </button>

      {aberto && (
        <DetalheTarefa
          tarefa={tarefa}
          aoFechar={() => setAberto(false)}
          aoAtualizar={aoAtualizar}
          membrosIniciais={membros}
          frentesIniciais={frentes}
        />
      )}
    </>
  );
}
