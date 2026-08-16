"use client";

import { useState } from "react";
import { dataLocalISO, diasEntre } from "@/lib/datas";
import { CLASSES_COR_FRENTE, STATUS, UNIDADES_FRENTE, responsaveisDe, type Tarefa, type Status } from "@/lib/types";
import DetalheTarefa from "./DetalheTarefa";
import Selo from "./Selo";
import SeloIssue from "./SeloIssue";

function diasAte(prazo: string | null) {
  if (!prazo) return null;
  return diasEntre(prazo, dataLocalISO());
}

function nomesResponsaveis(nomes: string[]) {
  if (nomes.length === 0) return "sem responsável";
  if (nomes.length <= 2) return nomes.join(", ");
  return nomes.map((n) => n.trim().charAt(0).toUpperCase()).join(", ");
}

export default function CartaoTarefa({
  tarefa,
  aoMudarStatus,
  aoArquivar,
  aoAtualizar,
  arrastavel,
}: {
  tarefa: Tarefa;
  aoMudarStatus?: (id: number, status: Status) => void;
  aoArquivar?: (id: number) => void;
  aoAtualizar?: () => void;
  arrastavel?: boolean;
}) {
  const dias = diasAte(tarefa.prazo);
  const atrasada = dias !== null && dias < 0 && tarefa.status !== "concluida";
  const [arrastando, setArrastando] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const responsaveis = responsaveisDe(tarefa);

  return (
    <article
      draggable={arrastavel}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(tarefa.id));
        setArrastando(true);
      }}
      onDragEnd={() => setArrastando(false)}
      className={`border bg-casca p-3 ${atrasada ? "border-trigo" : "border-linha"} ${
        arrastando ? "opacity-40" : ""
      } ${arrastavel ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setDetalheAberto(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDetalheAberto(true);
          }
        }}
        className="cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-sm font-semibold leading-snug">{tarefa.titulo}</h3>
          <div className="flex shrink-0 items-center gap-1">
            {tarefa.escopo === "frente" && (
              <span
                className={`border px-1.5 py-0.5 font-mono text-xs uppercase tracking-wide ${
                  CLASSES_COR_FRENTE[tarefa.frentes?.cor ?? "ferro"]
                }`}
              >
                {tarefa.frentes?.nome ?? "frente"}
              </span>
            )}
            {tarefa.prioridade === "alta" && (
              <span className="bg-trigo px-1.5 py-0.5 font-mono text-xs uppercase tracking-wide text-tinta">
                alta
              </span>
            )}
            <Selo status={tarefa.status} />
          </div>
        </div>

        {tarefa.descricao && (
          <p className="mt-1.5 line-clamp-2 text-xs text-tinta/70">{tarefa.descricao}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-tinta/70">
          <span>{nomesResponsaveis(responsaveis.map((m) => m.nome))}</span>
          {tarefa.frentes?.unidade && (
            <span className="border border-linha px-1 py-0.5 uppercase">
              {UNIDADES_FRENTE.find((u) => u.id === tarefa.frentes!.unidade)?.nome ?? tarefa.frentes.unidade}
            </span>
          )}
          {tarefa.prazo && (
            <span className={atrasada ? "font-semibold text-trigo" : ""}>
              {atrasada
                ? `${Math.abs(dias!)}d atrasada`
                : dias === 0
                ? "entrega hoje"
                : `faltam ${dias}d`}
            </span>
          )}
          {tarefa.local_entrega && (
            <a
              href={tarefa.local_entrega}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="underline"
            >
              entrega
            </a>
          )}
          <span className={tarefa.subiu_git ? "text-musgo" : "text-tinta/70"}>
            {tarefa.subiu_git ? "● git" : "○ git"}
          </span>
          {tarefa.issue_numero && (
            <span onClick={(e) => e.stopPropagation()}>
              <SeloIssue numero={tarefa.issue_numero} />
            </span>
          )}
        </div>
      </div>

      {(aoMudarStatus || aoArquivar) && (
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-linha pt-2">
          {aoMudarStatus &&
            STATUS.map((s) => (
              <button
                key={s.id}
                onClick={() => aoMudarStatus(tarefa.id, s.id)}
                disabled={s.id === tarefa.status}
                className="px-1.5 py-0.5 font-mono text-xs uppercase text-tinta/70 hover:bg-linha hover:text-tinta disabled:opacity-25"
              >
                {s.nome}
              </button>
            ))}
          {aoArquivar && (
            <button
              onClick={() => aoArquivar(tarefa.id)}
              className="ml-auto px-1.5 py-0.5 font-mono text-xs uppercase text-tinta/70 hover:text-trigo"
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
        />
      )}
    </article>
  );
}
