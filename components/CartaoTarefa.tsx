"use client";

import { useState } from "react";
import { dataLocalISO, diasEntre } from "@/lib/datas";
import { STATUS, UNIDADES, responsaveisDe, type Tarefa, type Status } from "@/lib/types";
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
  arrastavel,
}: {
  tarefa: Tarefa;
  aoMudarStatus?: (id: number, status: Status) => void;
  aoArquivar?: (id: number) => void;
  arrastavel?: boolean;
}) {
  const dias = diasAte(tarefa.prazo);
  const atrasada = dias !== null && dias < 0 && tarefa.status !== "concluida";
  const [arrastando, setArrastando] = useState(false);
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
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm font-semibold leading-snug">{tarefa.titulo}</h3>
        <div className="flex shrink-0 items-center gap-1">
          {tarefa.escopo === "frente" && (
            <span className="border border-musgo px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-musgo">
              frente
            </span>
          )}
          {tarefa.prioridade === "alta" && (
            <span className="bg-trigo px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-tinta">
              alta
            </span>
          )}
          <Selo status={tarefa.status} />
        </div>
      </div>

      {tarefa.descricao && (
        <p className="mt-1.5 line-clamp-2 text-xs text-tinta/70">{tarefa.descricao}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-tinta/60">
        <span>{nomesResponsaveis(responsaveis.map((m) => m.nome))}</span>
        <span className="border border-linha px-1 py-0.5 uppercase">
          {UNIDADES.find((u) => u.id === tarefa.unidade)?.nome ?? tarefa.unidade}
        </span>
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
          <a href={tarefa.local_entrega} target="_blank" rel="noreferrer" className="underline">
            entrega
          </a>
        )}
        <span className={tarefa.subiu_git ? "text-musgo" : "text-tinta/40"}>
          {tarefa.subiu_git ? "● git" : "○ git"}
        </span>
        {tarefa.issue_numero && <SeloIssue numero={tarefa.issue_numero} />}
      </div>

      {(aoMudarStatus || aoArquivar) && (
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-linha pt-2">
          {aoMudarStatus &&
            STATUS.map((s) => (
              <button
                key={s.id}
                onClick={() => aoMudarStatus(tarefa.id, s.id)}
                disabled={s.id === tarefa.status}
                className="px-1.5 py-0.5 font-mono text-[10px] uppercase text-tinta/50 hover:bg-linha hover:text-tinta disabled:opacity-25"
              >
                {s.nome}
              </button>
            ))}
          {aoArquivar && (
            <button
              onClick={() => aoArquivar(tarefa.id)}
              className="ml-auto px-1.5 py-0.5 font-mono text-[10px] uppercase text-tinta/40 hover:text-trigo"
            >
              arquivar
            </button>
          )}
        </div>
      )}
    </article>
  );
}
