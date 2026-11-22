"use client";

import { dataLocalISO, diasEntre, estaAtrasada } from "@/lib/datas";
import { progressoCriterios } from "@/lib/criterios";
import {
  CLASSES_COR_FRENTE_PREENCHIDA,
  CLASSES_PRIORIDADE,
  PRIORIDADES,
  STATUS,
  responsaveisDe,
  type Frente,
  type Membro,
  type Tarefa,
} from "@/lib/types";
import { useDetalheTarefa } from "./DetalheTarefaProvider";

/**
 * Uma tarefa como linha de caderno, para filas onde o cartão pesa demais.
 * Mesma gramática de sinais do cartão e do calendário: prioridade é forma
 * (glifo), atraso soma "!" por cima. Nada aqui depende de cor para ser lido.
 */
export default function LinhaTarefa({
  tarefa,
  aoAtualizar,
  membros,
  frentes,
  mostrarStatus = false,
  mostrarQuem = true,
  mostrarFrente = true,
}: {
  tarefa: Tarefa;
  aoAtualizar?: () => void;
  membros?: Membro[];
  frentes?: Frente[];
  mostrarStatus?: boolean;
  mostrarQuem?: boolean;
  mostrarFrente?: boolean;
}) {
  const abrirDetalhe = useDetalheTarefa();

  const hoje = dataLocalISO();
  const atrasada = estaAtrasada(tarefa.status, tarefa.prazo, hoje);
  const prio = CLASSES_PRIORIDADE[tarefa.prioridade];
  const nomePrio =
    PRIORIDADES.find((p) => p.id === tarefa.prioridade)?.nome ??
    tarefa.prioridade;
  const statusObj = STATUS.find((s) => s.id === tarefa.status);
  const nomeStatus = statusObj?.nome ?? tarefa.status;
  const responsaveis = responsaveisDe(tarefa);
  const progresso = progressoCriterios(tarefa.descricao);

  const nomes = responsaveis.map((m) => m.nome);
  const quem =
    nomes.length === 0
      ? "sem dono"
      : nomes.length <= 2
        ? nomes.join(" e ")
        : `${nomes[0]} +${nomes.length - 1}`;

  const dias = tarefa.prazo ? diasEntre(tarefa.prazo, hoje) : null;
  const prazoCurto =
    dias === null
      ? "—"
      : atrasada
        ? `${Math.abs(dias)}d`
        : dias === 0
          ? "hoje"
          : `${dias}d`;

  const concluida = mostrarStatus && tarefa.status === "concluida";

  const palavraStatus =
    mostrarStatus &&
    (tarefa.status === "fazendo" || tarefa.status === "revisao")
      ? nomeStatus.toLowerCase()
      : null;

  const temFrente = mostrarFrente && !!tarefa.frentes;
  const antesDaFrente = mostrarQuem || !!palavraStatus;
  const antesDoProgresso = antesDaFrente || temFrente;

  const rotulo =
    `${tarefa.titulo} · ${nomeStatus} · prioridade ${nomePrio}` +
    `${atrasada ? " · atrasada" : ""} · ${quem}` +
    `${tarefa.frentes ? ` · frente ${tarefa.frentes.nome}` : ""}` +
    `${tarefa.prazo ? ` · ${atrasada ? `${Math.abs(dias!)} dias de atraso` : dias === 0 ? "vence hoje" : `faltam ${dias} dias`}` : ""}` +
    `${progresso ? ` · ${progresso.feitos} de ${progresso.total} critérios` : ""}` +
    " · abrir detalhes";

  return (
    <button
      type="button"
      onClick={() =>
        abrirDetalhe({
          tarefa,
          aoAtualizar,
          membrosIniciais: membros,
          frentesIniciais: frentes,
        })
      }
      aria-label={rotulo}
      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg border-b border-linha/80 px-3 py-3 text-left transition-colors duration-micro ease-entrada last:border-b-0 hover:bg-casca/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-musgo sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,18rem)_auto]"
    >
      <span
        aria-hidden="true"
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-xs ${
          atrasada
            ? "border-trigo bg-trigo/20 font-bold text-tinta"
            : "border-linha bg-campo text-tinta/70"
        }`}
      >
        {atrasada && <span>!</span>}
        <span>{prio.glifo}</span>
      </span>

      <span className="min-w-0 break-words text-sm font-medium text-tinta">
        {tarefa.titulo}
      </span>

      <span className="col-start-2 row-start-2 min-w-0 break-words text-xs text-tinta/70 sm:col-auto sm:row-auto">
        {mostrarQuem && quem}
        {palavraStatus && (
          <>
            {mostrarQuem ? " · " : ""}
            <span className="rounded bg-casca px-1.5 py-0.5 font-medium text-tinta">
              {palavraStatus}
            </span>
          </>
        )}
        {temFrente && (
          <>
            {antesDaFrente ? " · " : ""}
            <span className="inline-flex items-center gap-1">
              <i
                aria-hidden="true"
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  CLASSES_COR_FRENTE_PREENCHIDA[tarefa.frentes!.cor ?? "ferro"]
                }`}
              />
              <span>frente {tarefa.frentes!.nome}</span>
            </span>
          </>
        )}
        {progresso && (
          <>
            {antesDoProgresso ? " · " : null}
            <span className="font-mono font-semibold text-musgo">
              {progresso.feitos}/{progresso.total}
            </span>
          </>
        )}
      </span>

      <span
        title={concluida ? "Concluída" : undefined}
        className={`col-start-3 row-start-1 shrink-0 rounded-md px-2 py-0.5 font-mono text-xs tabular-nums sm:col-auto sm:row-auto ${
          concluida
            ? "bg-musgo font-semibold text-campo"
            : atrasada
              ? "bg-trigo font-semibold text-tinta"
              : "bg-casca text-tinta/70"
        }`}
      >
        {concluida ? "✓" : prazoCurto}
      </span>
    </button>
  );
}
