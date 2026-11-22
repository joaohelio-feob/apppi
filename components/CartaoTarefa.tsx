"use client";

import { useState } from "react";
import { dataLocalISO, diasEntre, estaAtrasada } from "@/lib/datas";
import { progressoCriterios } from "@/lib/criterios";
import {
  CLASSES_COR_FRENTE,
  CLASSES_COR_FRENTE_PREENCHIDA,
  CLASSES_PRIORIDADE,
  CLASSES_PRIORIDADE_SELO,
  PRIORIDADES,
  STATUS,
  iniciaisDe,
  responsaveisDe,
  type Frente,
  type Membro,
  type Tarefa,
  type Status,
} from "@/lib/types";
import { useDetalheTarefa } from "./DetalheTarefaProvider";
import Selo from "./Selo";
import {
  IconeAlerta,
  IconeArquivo,
  IconeGit,
  IconeRelogio,
} from "./ui/Icones";

function textoDoPrazo(prazo: string, atrasada: boolean, hoje: string) {
  const dias = diasEntre(prazo, hoje);
  if (atrasada) return `${Math.abs(dias)}d atrasada`;
  if (dias === 0) return "entrega hoje";
  if (dias === 1) return "falta 1d";
  return `faltam ${dias}d`;
}

export default function CartaoTarefa({
  tarefa,
  aoMudarStatus,
  aoArquivar,
  aoAtualizar,
  arrastavel,
  membros,
  frentes,
  mostrarStatus = true,
}: {
  tarefa: Tarefa;
  aoMudarStatus?: (id: number, status: Status) => void;
  aoArquivar?: (id: number) => void;
  aoAtualizar?: () => void;
  arrastavel?: boolean;
  /**
   * Desligue onde a coluna já diz o status — no quadro o selo repete, em todo
   * cartão, o que o cabeçalho da coluna diz uma vez. Fica ligado por padrão
   * porque fora do quadro (a Semana, por exemplo) não há coluna nenhuma.
   */
  mostrarStatus?: boolean;
  /** Repassados ao painel de detalhe pra não duplicar a consulta quando a página já tem essas listas. */
  membros?: Membro[];
  frentes?: Frente[];
}) {
  const [arrastando, setArrastando] = useState(false);
  const abrirDetalhe = useDetalheTarefa();

  // Um `hoje` só para o cartão inteiro: evita divergência na virada do dia.
  const hoje = dataLocalISO();
  const atrasada = estaAtrasada(tarefa.status, tarefa.prazo, hoje);
  const prio = CLASSES_PRIORIDADE[tarefa.prioridade];
  const prioSelo = CLASSES_PRIORIDADE_SELO[tarefa.prioridade];
  const nomePrio =
    PRIORIDADES.find((p) => p.id === tarefa.prioridade)?.nome ??
    tarefa.prioridade;
  const responsaveis = responsaveisDe(tarefa);
  const progresso = progressoCriterios(tarefa.descricao);
  const nomes = responsaveis.map((m) => m.nome);
  const textoResponsaveis =
    nomes.length > 0 ? nomes.join(", ") : "sem responsável";

  const rotuloBotao =
    `${tarefa.titulo} · ${STATUS.find((s) => s.id === tarefa.status)?.nome ?? tarefa.status}` +
    ` · prioridade ${nomePrio}${atrasada ? " · atrasada" : ""}` +
    ` · ${textoResponsaveis}${progresso ? ` · ${progresso.feitos} de ${progresso.total} critérios` : ""}` +
    ` · abrir detalhes`;

  return (
    <article
      draggable={arrastavel}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(tarefa.id));
        setArrastando(true);
      }}
      onDragEnd={() => setArrastando(false)}
      className={`overflow-hidden rounded-xl border border-linha bg-papel shadow-cartao transition-[transform,box-shadow,opacity] duration-micro ease-entrada hover:-translate-y-0.5 hover:shadow-cartao-hover ${prio.borda} ${
        atrasada ? "ring-2 ring-trigo" : ""
      } ${arrastando ? "opacity-40" : ""} ${arrastavel ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {/* `relative` aqui delimita até onde o overlay do botão-título alcança:
          o corpo do cartão, nunca a barra de ações lá embaixo. */}
      <div className="relative p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs font-semibold ${prioSelo}`}
            title={`Prioridade ${nomePrio.toLowerCase()}`}
          >
            <span aria-hidden="true">{prio.glifo}</span>
            <span>{nomePrio}</span>
          </span>

          {tarefa.prazo ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs ${
                atrasada
                  ? "bg-trigo font-semibold text-tinta"
                  : "bg-casca text-tinta/70"
              }`}
            >
              {atrasada ? (
                <IconeAlerta className="h-3 w-3" />
              ) : (
                <IconeRelogio className="h-3 w-3" />
              )}
              {textoDoPrazo(tarefa.prazo, atrasada, hoje)}
            </span>
          ) : (
            <span className="font-mono text-xs text-tinta/70">Sem prazo</span>
          )}
        </div>

        <h3 className="mt-2.5 min-w-0 font-display text-sm font-bold leading-snug text-tinta">
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
            aria-label={rotuloBotao}
            className="block w-full text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-musgo"
          >
            <span className="break-words">
              {atrasada && (
                <span className="mr-1 inline-block rounded bg-trigo px-1 font-mono text-xs font-bold text-tinta">
                  !
                </span>
              )}
              {tarefa.titulo}
            </span>
          </button>
        </h3>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {mostrarStatus && !aoMudarStatus && <Selo status={tarefa.status} />}

          {tarefa.frentes && (
            <span
              className={`inline-flex max-w-[12rem] items-center gap-1.5 rounded-full border bg-campo px-2 py-0.5 text-xs font-medium ${
                CLASSES_COR_FRENTE[tarefa.frentes.cor ?? "ferro"]
              }`}
            >
              <i
                aria-hidden="true"
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                  CLASSES_COR_FRENTE_PREENCHIDA[tarefa.frentes.cor ?? "ferro"]
                }`}
              />
              <span className="truncate">{tarefa.frentes.nome}</span>
            </span>
          )}

          {tarefa.issue_numero && (
            <span className="inline-flex items-center gap-1 rounded-full border border-linha bg-casca/70 px-2 py-0.5 font-mono text-xs text-tinta/70">
              <IconeGit className="h-3 w-3" />#{tarefa.issue_numero}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          {responsaveis.length > 0 ? (
            <>
              <span className="flex -space-x-1.5">
                {responsaveis.slice(0, 3).map((m) => (
                  <span
                    key={m.id}
                    aria-hidden="true"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-papel bg-musgo font-mono text-xs font-semibold text-campo"
                  >
                    {iniciaisDe(m.nome)}
                  </span>
                ))}
              </span>
              <span className="min-w-0 truncate text-xs text-tinta/70">
                {nomes.slice(0, 2).join(", ")}
                {nomes.length > 2 ? ` +${nomes.length - 2}` : ""}
              </span>
            </>
          ) : (
            <span className="text-xs text-tinta/70">Sem responsável</span>
          )}
        </div>

        {/* Progresso zero não ganha trilho: barra vazia em largura total não
            comunica nada. Fica só o contador, que ocupa a linha nos dois
            estados — então nada salta quando o primeiro item é marcado. */}
        {progresso && progresso.feitos === 0 && (
          <div className="mt-2.5 border-t border-linha/70 pt-2">
            <span className="font-mono text-xs text-tinta/70">
              {progresso.feitos}/{progresso.total} critérios
            </span>
          </div>
        )}

        {progresso && progresso.feitos > 0 && (
          <div className="mt-2.5 flex items-center gap-2 border-t border-linha/70 pt-2">
            <span
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-linha"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progresso.total}
              aria-valuenow={progresso.feitos}
              aria-label={`${progresso.feitos} de ${progresso.total} critérios de aceite concluídos`}
            >
              <span
                className="block h-full w-full origin-left rounded-full bg-musgo transition-transform duration-micro ease-entrada"
                style={{
                  transform: `scaleX(${progresso.feitos / progresso.total})`,
                }}
              />
            </span>
            <span className="shrink-0 font-mono text-xs font-semibold text-musgo">
              ✓ {progresso.feitos}/{progresso.total}
            </span>
          </div>
        )}
      </div>

      {(aoMudarStatus || aoArquivar) && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-linha/80 bg-casca/45 px-3 py-2">
          {aoMudarStatus && (
            <select
              aria-label={`Status de ${tarefa.titulo}`}
              value={tarefa.status}
              onChange={(e) =>
                aoMudarStatus(tarefa.id, e.target.value as Status)
              }
              className="min-h-8 min-w-0 rounded-md border border-linha/80 bg-papel px-2 py-1 text-xs font-medium text-tinta hover:border-musgo"
            >
              {STATUS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          )}
          {aoArquivar && (
            <button
              type="button"
              onClick={() => aoArquivar(tarefa.id)}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-tinta/70 transition-colors duration-micro ease-entrada hover:bg-trigo hover:text-tinta"
            >
              <IconeArquivo className="h-3.5 w-3.5" />
              Arquivar
            </button>
          )}
        </div>
      )}
    </article>
  );
}
