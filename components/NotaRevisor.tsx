"use client";

import { useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataCurta } from "@/lib/datas";
import type { Revisao } from "@/lib/types";
import { IconeCheck, IconeRetorno } from "./ui/Icones";

type RevisaoComNome = Revisao & { membros?: { nome: string } | null };

/**
 * "Nota do revisor" (observação) ou "Falta isso:" (devolvida) — o resultado
 * mais recente em destaque, e o resto (se houver) num accordion de histórico.
 */
export default function NotaRevisor({
  tarefaId,
  entregueEm,
}: {
  tarefaId: number;
  entregueEm: string | null;
}) {
  const [historico, setHistorico] = useState<RevisaoComNome[]>([]);

  useEffect(() => {
    const supabase = criarClienteNavegador();
    supabase
      .from("revisoes")
      .select("*, membros:revisor_id(nome)")
      .eq("tarefa_id", tarefaId)
      .order("criado_em", { ascending: false })
      .then(({ data }) =>
        setHistorico((data ?? []) as unknown as RevisaoComNome[]),
      );
  }, [tarefaId]);

  if (historico.length === 0) return null;

  const [maisRecente, ...resto] = historico;
  const notaAtiva =
    maisRecente.resultado !== "concluido" &&
    (!entregueEm || new Date(maisRecente.criado_em) > new Date(entregueEm));
  const anteriores = notaAtiva ? resto : historico;

  return (
    <div className="mt-4 space-y-2.5">
      {notaAtiva && (
        <div
          className={`rounded-xl border border-l-4 px-3.5 py-3 ${
            maisRecente.resultado === "falta_algo"
              ? "border-trigo bg-trigo/15"
              : "border-musgo bg-musgo/10"
          }`}
        >
          <p
            className={`flex items-center gap-1.5 font-display text-xs font-bold ${
              maisRecente.resultado === "falta_algo"
                ? "text-tinta"
                : "text-musgo"
            }`}
          >
            {maisRecente.resultado === "falta_algo" ? (
              <IconeRetorno className="h-3.5 w-3.5" />
            ) : (
              <IconeCheck className="h-3.5 w-3.5" />
            )}
            {maisRecente.resultado === "falta_algo"
              ? "Falta isso:"
              : "Nota do revisor"}
          </p>
          <p className="mt-1 text-sm text-tinta">{maisRecente.comentario}</p>
          <p className="mt-1.5 font-mono text-xs text-tinta/70">
            {maisRecente.membros?.nome ?? "—"} ·{" "}
            {dataCurta(maisRecente.criado_em)}
          </p>
        </div>
      )}

      {historico.length > 1 && (
        <details className="rounded-xl border border-linha bg-papel px-3.5 py-2.5">
          <summary className="cursor-pointer text-xs font-semibold text-tinta/70">
            Histórico de revisões ({anteriores.length})
          </summary>
          <ul className="mt-2.5 space-y-2">
            {anteriores.map((r) => (
              <li
                key={r.id}
                className="border-t border-linha pt-2 text-sm first:border-t-0 first:pt-0"
              >
                <p className="font-mono text-xs text-tinta/70">
                  {r.resultado === "concluido"
                    ? "Concluído"
                    : r.resultado === "falta_algo"
                      ? "Falta algo"
                      : "Observações"}
                  {" · "}
                  {r.membros?.nome ?? "—"} · {dataCurta(r.criado_em)}
                </p>
                {r.comentario && (
                  <p className="mt-0.5 text-tinta">{r.comentario}</p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
