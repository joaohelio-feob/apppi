"use client";
import { useState } from "react";
import CartaoTarefa from "../CartaoTarefa";
import {
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

        return (
          <div
            key={coluna.id}
            // A área de soltar é a coluna inteira, não a lista visível: dá pra
            // soltar num ponto qualquer, inclusive numa coluna vazia ou numa
            // coluna colapsada (o cartão entra e o contador acompanha, mesmo
            // que ele caia fora do cap).
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
            className={`flex min-h-32 w-[85%] shrink-0 snap-start flex-col sm:w-[60%] md:w-[45%] lg:w-auto lg:shrink ${alvo === coluna.id ? "bg-casca ring-2 ring-inset ring-musgo" : ""}`}
          >
            {/* A navegação do site não é fixed nem sticky, então top-0 basta:
                o cabeçalho encosta no topo da janela e fica lá enquanto o
                grupo passa pela tela. */}
            <h3 className="sticky top-0 z-10 mb-3 flex items-baseline gap-2 border-b border-linha bg-campo pb-1 pt-1 font-display text-sm font-semibold uppercase tracking-wide">
              {coluna.nome}
              {/* Sempre o total real da coluna — nunca o que sobrou do cap. */}
              <span className="font-mono text-xs font-normal normal-case tracking-normal text-tinta/70">
                · {daColuna.length}
              </span>
            </h3>

            <div className="space-y-3">
              {mostrados.map((t) => (
                <CartaoTarefa
                  key={t.id}
                  tarefa={t}
                  // O cabeçalho da coluna já diz o status, uma vez, e é
                  // sticky — repeti-lo em cada cartão é tinta e altura.
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
                <p className="text-xs text-tinta/70">Coluna vazia.</p>
              )}

              {(escondidos > 0 || expandida) && (
                <button
                  onClick={() => aoAlternarColuna(chave)}
                  aria-expanded={expandida}
                  aria-label={
                    expandida
                      ? `ver menos em ${coluna.nome}, ${nomeDoGrupo}`
                      : `ver mais ${escondidos} em ${coluna.nome}, ${nomeDoGrupo}`
                  }
                  className="w-full border border-linha bg-casca px-3 py-1.5 text-xs text-tinta/70 transition-colors duration-micro ease-entrada hover:border-musgo hover:text-tinta"
                >
                  {expandida ? "ver menos" : `ver mais ${escondidos}`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
