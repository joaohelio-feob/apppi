"use client";

import { useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataCurta } from "@/lib/datas";
import type { Revisao } from "@/lib/types";

type RevisaoComNome = Revisao & { membros?: { nome: string } | null };

/**
 * "Nota do revisor" (observação) ou "Falta isso:" (devolvida) — o resultado
 * mais recente em destaque, e o resto (se houver) num accordion de
 * histórico. Some sozinho quando uma reentrega mais nova torna a revisão
 * mostrada obsoleta ("visível até a próxima entrega", regra do Bloco A).
 * Usado no DetalheTarefa e em /entregas (o "resumo final").
 */
export default function NotaRevisor({ tarefaId, entregueEm }: { tarefaId: number; entregueEm: string | null }) {
  const [historico, setHistorico] = useState<RevisaoComNome[]>([]);

  useEffect(() => {
    const supabase = criarClienteNavegador();
    supabase
      .from("revisoes")
      .select("*, membros:revisor_id(nome)")
      .eq("tarefa_id", tarefaId)
      .order("criado_em", { ascending: false })
      .then(({ data }) => setHistorico((data ?? []) as unknown as RevisaoComNome[]));
  }, [tarefaId]);

  if (historico.length === 0) return null;

  const [maisRecente, ...resto] = historico;
  const notaAtiva =
    maisRecente.resultado !== "concluido" &&
    (!entregueEm || new Date(maisRecente.criado_em) > new Date(entregueEm));
  const anteriores = notaAtiva ? resto : historico;

  return (
    <div className="mt-4 space-y-2">
      {notaAtiva && (
        <div
          className={`border px-3 py-2 ${
            maisRecente.resultado === "falta_algo" ? "border-trigo bg-trigo/10" : "border-musgo bg-musgo/10"
          }`}
        >
          <p className={`text-xs ${
            maisRecente.resultado === "falta_algo" ? "text-trigo" : "text-musgo"
          }`}>
            {maisRecente.resultado === "falta_algo" ? "Falta isso:" : "Nota do revisor"}
          </p>
          <p className="mt-1 text-sm">{maisRecente.comentario}</p>
          <p className="mt-1 font-mono text-xs text-tinta/70">
            {maisRecente.membros?.nome ?? "—"} · {dataCurta(maisRecente.criado_em)}
          </p>
        </div>
      )}

      {historico.length > 1 && (
        <details className="border border-linha bg-casca px-3 py-2">
          <summary className="cursor-pointer text-xs text-tinta/70">
            Histórico de revisões
            <span className="ml-1 text-tinta/70">({anteriores.length})</span>
          </summary>
          <ul className="mt-2 space-y-2">
            {anteriores.map((r) => (
              <li key={r.id} className="border-t border-linha pt-2 text-sm first:border-t-0 first:pt-0">
                <p className="text-xs text-tinta/70">
                  {r.resultado === "concluido" ? "Concluído" : r.resultado === "falta_algo" ? "Falta algo" : "Observações"}
                  {" · "}{r.membros?.nome ?? "—"} · {dataCurta(r.criado_em)}
                </p>
                {r.comentario && <p className="mt-0.5">{r.comentario}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
