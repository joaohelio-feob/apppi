"use client";

import { useState } from "react";
import { dataLocalISO, diasEntre, estaAtrasada } from "@/lib/datas";
import { progressoCriterios } from "@/lib/criterios";
import {
  CLASSES_PRIORIDADE,
  PRIORIDADES,
  STATUS,
  responsaveisDe,
  type Frente,
  type Membro,
  type Tarefa,
  type Status,
} from "@/lib/types";
import { useDetalheTarefa } from "./DetalheTarefaProvider";
import Selo from "./Selo";

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

  // Um `hoje` só para o cartão inteiro: se "está atrasada?" e "faltam N dias"
  // chamassem dataLocalISO() cada um por sua conta, um cartão renderizado
  // exatamente na virada do dia poderia dizer "faltam 0d" sem o "!" de atraso.
  const hoje = dataLocalISO();
  const atrasada = estaAtrasada(tarefa.status, tarefa.prazo, hoje);
  const prio = CLASSES_PRIORIDADE[tarefa.prioridade];
  const nomePrio =
    PRIORIDADES.find((p) => p.id === tarefa.prioridade)?.nome ??
    tarefa.prioridade;
  const responsaveis = responsaveisDe(tarefa);
  const progresso = progressoCriterios(tarefa.descricao);
  const nomes = responsaveis.map((m) => m.nome);
  const textoResponsaveis =
    nomes.length > 0 ? nomes.join(", ") : "sem responsável";

  // Tudo que a cor comunica, repetido em palavras — o leitor de tela (e quem
  // não distingue as cores) recebe status, prioridade e atraso pelo texto.
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
      className={`border border-linha bg-casca transition-opacity duration-micro ease-entrada ${prio.borda} ${
        atrasada ? "ring-1 ring-trigo" : ""
      } ${arrastando ? "opacity-40" : ""} ${arrastavel ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {/* `relative` aqui delimita até onde o overlay do botão-título alcança:
          o corpo do cartão, nunca a barra de ações lá embaixo. */}
      <div className="relative p-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 font-display text-sm font-semibold leading-snug">
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
              // O botão é só o título, mas o `after` estica a área clicável
              // por cima do cartão inteiro — é o que faz clicar em qualquer
              // canto abrir o detalhe sem aninhar <a> dentro de <button>
              // (HTML inválido, e o teclado se perde). Os links de verdade
              // sobem pra cima do overlay com `relative z-10`.
              className="block text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-musgo"
            >
              <span className="break-words">
                {atrasada && (
                  <span className="font-mono font-bold text-tinta">! </span>
                )}
                <span
                  className="font-mono"
                  title={`Prioridade ${nomePrio.toLowerCase()}`}
                >
                  {prio.glifo}
                </span>{" "}
                {tarefa.titulo}
              </span>
            </button>
          </h3>
        </div>
        <p
          className={`mt-2 text-xs ${atrasada ? "font-semibold text-tinta" : "text-tinta/70"}`}
        >
          {tarefa.prazo
            ? textoDoPrazo(tarefa.prazo, atrasada, hoje)
            : "Sem prazo"}
        </p>
        <p className="mt-1 break-words text-xs text-tinta/70">
          {nomes.slice(0, 2).join(", ") || "Sem responsável"}
          {nomes.length > 2 ? ` +${nomes.length - 2}` : ""}
        </p>
        {mostrarStatus && !aoMudarStatus && (
          <div className="mt-2">
            <Selo status={tarefa.status} />
          </div>
        )}
        {tarefa.escopo === "frente" && tarefa.frentes && (
          <p className="mt-1 break-words text-xs text-tinta/70">
            Frente: {tarefa.frentes.nome}
          </p>
        )}

        {/* Progresso zero não ganha trilho: barra vazia em largura total não
            comunica nada. Fica só o contador, que ocupa a linha nos dois
            estados — então nada salta quando o primeiro item é marcado. */}
        {progresso && progresso.feitos === 0 && (
          <div className="mt-2">
            <span className="font-mono text-xs text-tinta/70">
              {progresso.feitos}/{progresso.total} critérios
            </span>
          </div>
        )}

        {progresso && progresso.feitos > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span
              className="h-1 flex-1 bg-linha"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progresso.total}
              aria-valuenow={progresso.feitos}
              aria-label={`${progresso.feitos} de ${progresso.total} critérios de aceite concluídos`}
            >
              {/* scaleX em vez de width: animar largura força reflow a cada
                  quadro. transform-origin na esquerda faz a barra crescer da
                  esquerda, igual à versão anterior — a diferença é só que o
                  compositor cuida disso, não o layout. */}
              <span
                className="block h-full w-full origin-left bg-musgo transition-transform duration-micro ease-entrada"
                style={{
                  transform: `scaleX(${progresso.feitos / progresso.total})`,
                }}
              />
            </span>
            <span className="shrink-0 font-mono text-xs text-tinta/70">
              ✓ {progresso.feitos}/{progresso.total}
            </span>
          </div>
        )}
      </div>

      {(aoMudarStatus || aoArquivar) && (
        <div className="flex flex-wrap items-center gap-1 border-t border-linha px-3 py-2">
          {aoMudarStatus && (
            <select
              aria-label={`Status de ${tarefa.titulo}`}
              value={tarefa.status}
              onChange={(e) =>
                aoMudarStatus(tarefa.id, e.target.value as Status)
              }
              className="min-h-8 min-w-0 border border-transparent bg-transparent py-1 text-xs hover:border-linha"
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
              onClick={() => aoArquivar(tarefa.id)}
              className="ml-auto px-1.5 py-0.5 text-xs text-tinta/70 transition-colors duration-micro ease-entrada hover:bg-trigo hover:text-tinta"
            >
              arquivar
            </button>
          )}
        </div>
      )}
    </article>
  );
}
