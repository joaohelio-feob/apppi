"use client";

import { useEffect, useState } from "react";
import { ROTULOS_ATIVIDADE } from "@/lib/atividade";
import { criarClienteNavegador } from "@/lib/supabase-browser";

type Atividade = {
  id: number;
  em: string;
  acao: string;
  campo: string | null;
  valor_novo: string | null;
};

export default function AtividadeTarefa({ tarefaId }: { tarefaId: number }) {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">(
    "carregando",
  );
  useEffect(() => {
    let ativo = true;
    criarClienteNavegador()
      .from("historico")
      .select("id, em, acao, campo, valor_novo")
      .eq("tarefa_id", tarefaId)
      .order("em", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (ativo) {
          setAtividades((data ?? []) as Atividade[]);
          setEstado(error ? "erro" : "pronto");
        }
      });
    return () => {
      ativo = false;
    };
  }, [tarefaId]);
  if (estado !== "pronto")
    return (
      <p role="status" className="text-sm text-tinta/70">
        {estado === "erro"
          ? "Não foi possível carregar a atividade."
          : "Carregando atividade…"}
      </p>
    );
  return atividades.length ? (
    <ol className="divide-y divide-linha">
      {atividades.map((a) => (
        <li
          key={a.id}
          className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
        >
          <span>{ROTULOS_ATIVIDADE[a.acao] ?? a.acao}</span>
          <time dateTime={a.em} className="font-mono text-xs text-tinta/70">
            {new Date(a.em).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </li>
      ))}
    </ol>
  ) : (
    <p className="text-sm text-tinta/70">Nenhuma atividade registrada.</p>
  );
}
