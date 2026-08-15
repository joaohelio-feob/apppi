"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataLocalISO, diasEntre } from "@/lib/datas";
import { UNIDADES, type Membro, type Tarefa } from "@/lib/types";

export default function PainelMembro() {
  const { id } = useParams<{ id: string }>();
  const [membro, setMembro] = useState<Membro | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const supabase = criarClienteNavegador();
    Promise.all([
      supabase.from("membros").select("id, nome, papel, criado_em").eq("id", id).single(),
      supabase.from("tarefas").select("*, membros:responsavel_id(id, nome, papel)").eq("responsavel_id", id),
    ]).then(([{ data: m }, { data: t }]) => {
      setMembro((m ?? null) as Membro | null);
      setTarefas((t ?? []) as Tarefa[]);
      setCarregando(false);
    });
  }, [id]);

  if (carregando) return <p className="mt-10 font-mono text-sm text-tinta/50">carregando…</p>;

  if (!membro) {
    return (
      <div>
        <p className="text-sm text-tinta/60">Integrante não encontrado.</p>
        <Link href="/equipe" className="mt-2 inline-block text-sm underline">← voltar pra Equipe</Link>
      </div>
    );
  }

  const concluidas = tarefas.filter((t) => t.status === "concluida");

  const duracoes = concluidas
    .filter((t) => t.inicio && t.concluido_em)
    .map((t) => diasEntre(dataLocalISO(new Date(t.concluido_em!)), t.inicio!));
  const tempoMedio = duracoes.length > 0
    ? Math.round((duracoes.reduce((a, b) => a + b, 0) / duracoes.length) * 10) / 10
    : null;

  const atrasadas = tarefas.filter((t) => {
    if (!t.prazo) return false;
    if (t.concluido_em) return dataLocalISO(new Date(t.concluido_em)) > t.prazo;
    return t.status !== "concluida" && t.prazo < dataLocalISO();
  });

  const porUnidade = concluidas.reduce<Record<string, number>>((acc, t) => {
    const nome = UNIDADES.find((u) => u.id === t.unidade)?.nome ?? t.unidade;
    acc[nome] = (acc[nome] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <Link href="/equipe" className="font-mono text-xs text-tinta/50 underline underline-offset-4">
        ← Equipe
      </Link>
      <p className="mt-3 font-mono text-xs uppercase tracking-widest text-musgo">Painel individual</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">{membro.nome}</h1>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Estatistica rotulo="Concluídas" valor={concluidas.length} />
        <Estatistica rotulo="Tempo médio" valor={tempoMedio !== null ? `${tempoMedio}d` : "—"} />
        <Estatistica rotulo="Atrasaram" valor={atrasadas.length} />
        <Estatistica rotulo="Total de tarefas" valor={tarefas.length} />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 border-b border-linha pb-1 font-display text-lg font-semibold">
          Distribuição por unidade de estudo
        </h2>
        {Object.keys(porUnidade).length === 0 ? (
          <p className="text-sm text-tinta/50">Ainda sem tarefas concluídas.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(porUnidade)
              .sort((a, b) => b[1] - a[1])
              .map(([nome, total]) => {
                const maior = Math.max(...Object.values(porUnidade));
                return (
                  <div key={nome} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-sm">{nome}</span>
                    <div className="h-3 flex-1 bg-linha">
                      <div className="h-full bg-musgo" style={{ width: `${(total / maior) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right font-mono text-xs text-tinta/60">{total}</span>
                  </div>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}

function Estatistica({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div className="border border-linha bg-casca p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-tinta/50">{rotulo}</p>
      <p className="mt-1 font-display text-2xl font-bold">{valor}</p>
    </div>
  );
}
