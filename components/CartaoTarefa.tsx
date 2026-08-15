"use client";

import { STATUS, type Tarefa, type Status } from "@/lib/types";
import Selo from "./Selo";

function diasAte(prazo: string | null) {
  if (!prazo) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(prazo + "T00:00:00");
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

export default function CartaoTarefa({
  tarefa,
  aoMudarStatus,
}: {
  tarefa: Tarefa;
  aoMudarStatus?: (id: number, status: Status) => void;
}) {
  const dias = diasAte(tarefa.prazo);
  const atrasada = dias !== null && dias < 0 && tarefa.status !== "concluida";

  return (
    <article
      className={`border bg-casca p-3 ${atrasada ? "border-trigo" : "border-linha"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm font-semibold leading-snug">{tarefa.titulo}</h3>
        <Selo status={tarefa.status} />
      </div>

      {tarefa.descricao && (
        <p className="mt-1.5 line-clamp-2 text-xs text-tinta/70">{tarefa.descricao}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-tinta/60">
        <span>{tarefa.membros?.nome ?? "sem responsável"}</span>
        {tarefa.prazo && (
          <span className={atrasada ? "font-semibold text-trigo" : ""}>
            {atrasada
              ? `${Math.abs(dias!)}d atrasada`
              : dias === 0
              ? "entrega hoje"
              : `faltam ${dias}d`}
          </span>
        )}
        {tarefa.issue_url && (
          <a href={tarefa.issue_url} target="_blank" rel="noreferrer" className="underline">
            issue
          </a>
        )}
      </div>

      {aoMudarStatus && (
        <div className="mt-3 flex gap-1 border-t border-linha pt-2">
          {STATUS.map((s) => (
            <button
              key={s.id}
              onClick={() => aoMudarStatus(tarefa.id, s.id)}
              disabled={s.id === tarefa.status}
              className="px-1.5 py-0.5 font-mono text-[10px] uppercase text-tinta/50 hover:bg-linha hover:text-tinta disabled:opacity-25"
            >
              {s.nome}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
