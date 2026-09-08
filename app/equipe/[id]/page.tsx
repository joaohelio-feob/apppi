"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataLocalISO, diasEntre } from "@/lib/datas";
import { UNIDADES_FRENTE, type Membro, type Tarefa } from "@/lib/types";

export default function PainelMembro() {
  const { id } = useParams<{ id: string }>();
  const [membro, setMembro] = useState<Membro | null>(null);
  const [individuais, setIndividuais] = useState<Tarefa[]>([]);
  const [deFrente, setDeFrente] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const supabase = criarClienteNavegador();
    // BlocoTarefas só usa status/inicio/concluido_em/prazo e a unidade da
    // frente — não precisa de título nem dos nomes dos responsáveis; o join
    // com tarefa_responsaveis serve só pro filtro .eq(membro_id) abaixo.
    const selecao = "id, status, inicio, concluido_em, prazo, tarefa_responsaveis!inner(membro_id), frentes(unidade)";

    Promise.all([
      supabase.from("membros").select("id, nome, papel, criado_em").eq("id", id).single(),
      supabase.from("tarefas").select(selecao).eq("tarefa_responsaveis.membro_id", id).eq("escopo", "individual"),
      supabase.from("tarefas").select(selecao).eq("tarefa_responsaveis.membro_id", id).eq("escopo", "frente"),
    ]).then(([{ data: m }, { data: ti }, { data: tf }]) => {
      setMembro((m ?? null) as Membro | null);
      setIndividuais((ti ?? []) as unknown as Tarefa[]);
      setDeFrente((tf ?? []) as unknown as Tarefa[]);
      setCarregando(false);
    });
  }, [id]);

  if (carregando) return <p className="mt-10 text-sm text-tinta/70">carregando…</p>;

  if (!membro) {
    return (
      <div>
        <p className="text-sm text-tinta/70">Integrante não encontrado.</p>
        <Link href="/equipe" className="mt-2 inline-block text-sm underline">← voltar pra Equipe</Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/equipe" className="font-mono text-xs text-tinta/70 underline underline-offset-4">
        ← Equipe
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{membro.nome}</h1>
        <p className="text-sm text-tinta/70">painel individual</p>
      </div>
      <p className="mt-2 max-w-prose text-sm text-tinta/70">
        O que {membro.nome.split(" ")[0]} fez sozinho, separado do que fez junto com a frente.
      </p>

      <div className="mt-10 space-y-12">
        <BlocoTarefas titulo="Trabalho individual" tarefas={individuais} />
        <BlocoTarefas titulo="Trabalho da frente" tarefas={deFrente} />
      </div>
    </div>
  );
}

function BlocoTarefas({ titulo, tarefas }: { titulo: string; tarefas: Tarefa[] }) {
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
    const nome = t.frentes?.unidade
      ? UNIDADES_FRENTE.find((u) => u.id === t.frentes!.unidade)?.nome ?? t.frentes.unidade
      : "sem frente";
    acc[nome] = (acc[nome] ?? 0) + 1;
    return acc;
  }, {});
  const maiorUnidade = Math.max(1, ...Object.values(porUnidade));

  return (
    <section>
      <h2 className="mb-3 border-b border-linha pb-1 font-display text-lg font-semibold">{titulo}</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Estatistica rotulo="Concluídas" valor={concluidas.length} />
        <Estatistica rotulo="Tempo médio" valor={tempoMedio !== null ? `${tempoMedio}d` : "—"} />
        <Estatistica rotulo="Atrasaram" valor={atrasadas.length} />
        <Estatistica rotulo="Total" valor={tarefas.length} />
      </div>

      <div className="mt-4">
        <h3 className="mb-2 font-display text-xs font-semibold text-tinta/70">
          Distribuição por unidade de estudo
        </h3>
        {Object.keys(porUnidade).length === 0 ? (
          <p className="text-sm text-tinta/70">Ainda sem tarefas concluídas.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(porUnidade)
              .sort((a, b) => b[1] - a[1])
              .map(([nome, total]) => (
                <div key={nome} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-sm">{nome}</span>
                  <div className="h-3 flex-1 bg-linha">
                    <div className="h-full bg-musgo" style={{ width: `${(total / maiorUnidade) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right font-mono text-xs text-tinta/70">{total}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Estatistica({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div className="border border-linha bg-casca p-3">
      <p className="text-xs text-tinta/70">{rotulo}</p>
      <p className="mt-1 font-display text-2xl font-bold">{valor}</p>
    </div>
  );
}
