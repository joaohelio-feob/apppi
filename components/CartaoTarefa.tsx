"use client";

import { useState } from "react";
import { dataLocalISO, diasEntre, estaAtrasada } from "@/lib/datas";
import { progressoCriterios, textoSemCriterios } from "@/lib/criterios";
import { lerLocalEntrega } from "@/lib/links";
import {
  CLASSES_COR_FRENTE, CLASSES_COR_FRENTE_PREENCHIDA, CLASSES_PRIORIDADE,
  PRIORIDADES, STATUS, UNIDADES_FRENTE, responsaveisDe,
  type Frente, type Membro, type Tarefa, type Status,
} from "@/lib/types";
import DetalheTarefa from "./DetalheTarefa";
import Selo from "./Selo";
import SeloIssue from "./SeloIssue";

/** Duas letras: primeira do primeiro nome, primeira do último. "Ana" -> "AN". */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "??";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function textoDoPrazo(prazo: string, atrasada: boolean, hoje: string) {
  const dias = diasEntre(prazo, hoje);
  if (atrasada) return `${Math.abs(dias)}d atrasada`;
  if (dias === 0) return "entrega hoje";
  if (dias === 1) return "falta 1d";
  return `faltam ${dias}d`;
}

/** Ícone de link — SVG inline porque o projeto não tem (nem vai ter) biblioteca de ícones. */
function IconeLink() {
  return (
    <svg
      viewBox="0 0 16 16" width="12" height="12" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      aria-hidden="true" focusable="false" className="shrink-0"
    >
      <path d="M6.5 9.5 9.5 6.5" />
      <path d="M7 4.5 8.6 2.9a2.7 2.7 0 0 1 3.8 3.8L10.8 8.3" />
      <path d="M9 11.5 7.4 13.1a2.7 2.7 0 0 1-3.8-3.8L5.2 7.7" />
    </svg>
  );
}

export default function CartaoTarefa({
  tarefa,
  aoMudarStatus,
  aoArquivar,
  aoAtualizar,
  arrastavel,
  membros,
  frentes,
  pendenteGit,
}: {
  tarefa: Tarefa;
  aoMudarStatus?: (id: number, status: Status) => void;
  aoArquivar?: (id: number) => void;
  aoAtualizar?: () => void;
  arrastavel?: boolean;
  /** Repassados ao painel de detalhe pra não duplicar a consulta quando a página já tem essas listas. */
  membros?: Membro[];
  frentes?: Frente[];
  /**
   * `pendente_git` da view tarefas_estado_entrega. O cartão só EXIBE — não
   * recalcula, nem consulta: quem tem a lista (o Quadro) passa pra cá. Quem
   * não passa simplesmente não mostra o badge.
   */
  pendenteGit?: boolean;
}) {
  const [arrastando, setArrastando] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState(false);

  // Um `hoje` só para o cartão inteiro: se "está atrasada?" e "faltam N dias"
  // chamassem dataLocalISO() cada um por sua conta, um cartão renderizado
  // exatamente na virada do dia poderia dizer "faltam 0d" sem o "!" de atraso.
  const hoje = dataLocalISO();
  const atrasada = estaAtrasada(tarefa.status, tarefa.prazo, hoje);
  const prio = CLASSES_PRIORIDADE[tarefa.prioridade];
  const nomePrio = PRIORIDADES.find((p) => p.id === tarefa.prioridade)?.nome ?? tarefa.prioridade;
  const responsaveis = responsaveisDe(tarefa);
  const progresso = progressoCriterios(tarefa.descricao);
  const resumo = textoSemCriterios(tarefa.descricao);
  const local = lerLocalEntrega(tarefa.local_entrega);
  const unidade = tarefa.frentes?.unidade
    ? UNIDADES_FRENTE.find((u) => u.id === tarefa.frentes!.unidade)?.nome ?? tarefa.frentes.unidade
    : null;

  const nomes = responsaveis.map((m) => m.nome);
  const visiveis = responsaveis.slice(0, 3);
  const excedente = responsaveis.length - visiveis.length;
  const textoResponsaveis = nomes.length > 0 ? nomes.join(", ") : "sem responsável";

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
      className={`border border-linha bg-casca transition duration-150 ${prio.borda} ${
        atrasada ? "ring-1 ring-trigo" : ""
      } ${arrastando ? "opacity-40" : ""} ${arrastavel ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {/* `relative` aqui delimita até onde o overlay do botão-título alcança:
          o corpo do cartão, nunca a barra de ações lá embaixo. */}
      <div className="relative p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 font-display text-sm font-semibold leading-snug">
            <button
              type="button"
              onClick={() => setDetalheAberto(true)}
              aria-label={rotuloBotao}
              // O botão é só o título, mas o `after` estica a área clicável
              // por cima do cartão inteiro — é o que faz clicar em qualquer
              // canto abrir o detalhe sem aninhar <a> dentro de <button>
              // (HTML inválido, e o teclado se perde). Os links de verdade
              // sobem pra cima do overlay com `relative z-10`.
              className="block text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-musgo"
            >
              <span className="line-clamp-2 break-words">
                {atrasada && <span className="font-mono text-trigo">! </span>}
                <span className="font-mono" title={`Prioridade ${nomePrio.toLowerCase()}`}>
                  {prio.glifo}
                </span>{" "}
                {tarefa.titulo}
              </span>
            </button>
          </h3>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <Selo status={tarefa.status} />
            {tarefa.frentes && (
              <span
                className={`flex max-w-[9rem] items-center gap-1 border px-1.5 py-0.5 font-mono text-xs uppercase tracking-wide ${
                  CLASSES_COR_FRENTE[tarefa.frentes.cor ?? "ferro"]
                }`}
                title={
                  tarefa.escopo === "frente"
                    ? `Tarefa da frente ${tarefa.frentes.nome} — todos os integrantes`
                    : `Tarefa individual, matéria da frente ${tarefa.frentes.nome}`
                }
              >
                {tarefa.escopo === "frente" && (
                  <i
                    aria-hidden="true"
                    className={`inline-block h-1.5 w-1.5 shrink-0 ${
                      CLASSES_COR_FRENTE_PREENCHIDA[tarefa.frentes.cor ?? "ferro"]
                    }`}
                  />
                )}
                <span className="truncate">{tarefa.frentes.nome}</span>
              </span>
            )}
          </div>
        </div>

        {resumo && <p className="mt-1.5 line-clamp-2 break-words text-xs text-tinta/70">{resumo}</p>}

        {progresso && (
          <div className="mt-2 flex items-center gap-2">
            <span
              className="h-1 flex-1 bg-linha"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progresso.total}
              aria-valuenow={progresso.feitos}
              aria-label={`${progresso.feitos} de ${progresso.total} critérios de aceite concluídos`}
            >
              <span
                className="block h-full bg-musgo transition-[width] duration-150"
                style={{ width: `${(progresso.feitos / progresso.total) * 100}%` }}
              />
            </span>
            <span className="shrink-0 font-mono text-xs text-tinta/70">
              ✓ {progresso.feitos}/{progresso.total}
            </span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 font-mono text-xs text-tinta/70">
          {responsaveis.length === 0 ? (
            <span className="border border-dashed border-linha px-1.5 py-0.5">sem dono</span>
          ) : (
            <span className="flex items-center gap-1" title={textoResponsaveis}>
              {visiveis.map((m) => (
                <span
                  key={m.id}
                  className="rounded bg-linha px-1.5 py-0.5 text-tinta"
                  title={m.nome}
                >
                  {iniciais(m.nome)}
                </span>
              ))}
              {excedente > 0 && (
                <span className="rounded border border-linha px-1.5 py-0.5" aria-label={textoResponsaveis}>
                  +{excedente}
                </span>
              )}
            </span>
          )}

          {unidade && <span className="border border-linha px-1 py-0.5 uppercase">{unidade}</span>}

          {tarefa.prazo && (
            <span className={atrasada ? "font-semibold text-trigo" : ""}>
              {textoDoPrazo(tarefa.prazo, atrasada, hoje)}
            </span>
          )}

          {pendenteGit && (
            <span className="bg-trigo px-1.5 py-0.5 uppercase tracking-wide text-tinta">
              pendente no git
            </span>
          )}

          {local &&
            (local.tipo === "link" ? (
              <a
                href={local.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={local.titulo}
                // z-10 obrigatório: sem isso o overlay do título come o clique.
                className="relative z-10 flex min-w-0 max-w-[14rem] items-center gap-1 underline underline-offset-4 hover:text-musgo"
              >
                <IconeLink />
                <span className="truncate">{local.rotulo}</span>
              </a>
            ) : (
              <span className="flex min-w-0 max-w-[14rem] items-center gap-1" title={local.titulo}>
                <IconeLink />
                <span className="truncate">{local.rotulo}</span>
              </span>
            ))}

          <span className={tarefa.subiu_git ? "text-musgo" : "text-tinta/70"}>
            {tarefa.subiu_git ? "● git" : "○ git"}
          </span>

          {tarefa.issue_numero && (
            <span className="relative z-10" onClick={(e) => e.stopPropagation()}>
              <SeloIssue numero={tarefa.issue_numero} />
            </span>
          )}
        </div>
      </div>

      {(aoMudarStatus || aoArquivar) && (
        <div className="flex flex-wrap items-center gap-1 border-t border-linha px-3 py-2">
          {aoMudarStatus &&
            STATUS.map((s) => (
              <button
                key={s.id}
                onClick={() => aoMudarStatus(tarefa.id, s.id)}
                disabled={s.id === tarefa.status}
                className="px-1.5 py-0.5 font-mono text-xs uppercase text-tinta/70 transition duration-150 hover:bg-linha hover:text-tinta disabled:opacity-25"
              >
                {s.nome}
              </button>
            ))}
          {aoArquivar && (
            <button
              onClick={() => aoArquivar(tarefa.id)}
              className="ml-auto px-1.5 py-0.5 font-mono text-xs uppercase text-tinta/70 transition duration-150 hover:text-trigo"
            >
              arquivar
            </button>
          )}
        </div>
      )}

      {detalheAberto && (
        <DetalheTarefa
          tarefa={tarefa}
          aoFechar={() => setDetalheAberto(false)}
          aoAtualizar={aoAtualizar}
          membrosIniciais={membros}
          frentesIniciais={frentes}
        />
      )}
    </article>
  );
}
