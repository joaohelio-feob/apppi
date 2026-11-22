"use client";

import { useState } from "react";
import CartaoTarefa from "../CartaoTarefa";
import {
  INFO_STATUS,
  STATUS,
  type Status,
  type Tarefa,
  type Membro,
  type Frente,
} from "@/lib/types";

const CAP_COLUNA = 8;

export default function QuadroTarefas({
  grupo,
  nomeDoGrupo,
  tarefas,
  expandidas,
  aoAlternarColuna,
  aoMudarStatus,
  aoArquivar,
  aoAtualizar,
  membros,
  frentes,
}: {
  grupo: string;
  nomeDoGrupo: string;
  tarefas: Tarefa[];
  expandidas: Set<string>;
  aoAlternarColuna: (chave: string) => void;
  aoMudarStatus: (id: number, status: Status) => void;
  aoArquivar: (id: number) => void;
  aoAtualizar: () => void;
  membros: Membro[];
  frentes: Frente[];
}) {
  const [alvo, setAlvo] = useState<Status | null>(null);
  return (
    // Abaixo de lg o quadro vira uma faixa horizontal com snap por coluna;
    // de lg pra cima, as quatro colunas lado a lado. Nunca há scroll vertical
    // aninhado: o cap de cartões por coluna é que segura a altura.
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0">
      {STATUS.map((coluna) => {
        const daColuna = tarefas.filter((t) => t.status === coluna.id);
        const chave = `${grupo}::${coluna.id}`;
        const expandida = expandidas.has(chave);
        const mostrados = expandida ? daColuna : daColuna.slice(0, CAP_COLUNA);
        const escondidos = daColuna.length - mostrados.length;
        const info = INFO_STATUS[coluna.id];

        return (
          <div
            key={coluna.id}
            onDragOver={(e) => {
              e.preventDefault();
              setAlvo(coluna.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                setAlvo(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setAlvo(null);
              const id = Number(e.dataTransfer.getData("text/plain"));
              if (id) aoMudarStatus(id, coluna.id);
            }}
            className={`flex min-h-40 w-[85%] shrink-0 snap-start flex-col rounded-xl border border-linha/80 border-t-4 p-3 transition-colors duration-micro ease-entrada sm:w-[60%] md:w-[45%] lg:w-auto lg:shrink ${info.bordaTopo} ${
              alvo === coluna.id
                ? "bg-broto/15 ring-2 ring-inset ring-musgo"
                : "bg-casca/45"
            }`}
          >
            {/* A navegação do site é static, então top-0 basta:
                o cabeçalho encosta no topo da janela e fica lá enquanto o
                grupo passa pela tela. */}
            <div className="sticky top-0 z-10 mb-3 rounded-lg bg-campo/95 px-2.5 py-2 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-tinta">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${info.ponto}`}
                  />
                  {coluna.nome}
                </h3>
                <span className="rounded-full border border-linha bg-papel px-2 py-0.5 font-mono text-xs font-semibold text-tinta">
                  {daColuna.length}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-tinta/70">{info.resumo}</p>
            </div>

            <div className="space-y-3">
              {mostrados.map((t) => (
                <CartaoTarefa
                  key={t.id}
                  tarefa={t}
                  mostrarStatus={false}
                  aoMudarStatus={aoMudarStatus}
                  aoArquivar={aoArquivar}
                  aoAtualizar={aoAtualizar}
                  membros={membros}
                  frentes={frentes}
                  arrastavel
                />
              ))}

              {daColuna.length === 0 && (
                <div className="rounded-lg border border-dashed border-linha bg-papel/60 px-3 py-6 text-center text-xs text-tinta/70">
                  Coluna vazia. Arraste um cartão para cá para mudar o status.
                </div>
              )}

              {(escondidos > 0 || expandida) && (
                <button
                  type="button"
                  onClick={() => aoAlternarColuna(chave)}
                  aria-expanded={expandida}
                  aria-label={
                    expandida
                      ? `ver menos em ${coluna.nome}, ${nomeDoGrupo}`
                      : `ver mais ${escondidos} em ${coluna.nome}, ${nomeDoGrupo}`
                  }
                  className="botao botao-secundario w-full text-xs"
                >
                  {expandida ? "Ver menos" : `Ver mais ${escondidos}`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
