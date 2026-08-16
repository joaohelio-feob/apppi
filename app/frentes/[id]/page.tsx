"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { responsaveisDe, type Frente, type Membro, type Tarefa } from "@/lib/types";
import CartaoTarefa from "@/components/CartaoTarefa";

export default function PainelFrente() {
  const { id } = useParams<{ id: string }>();
  const [frente, setFrente] = useState<Frente | null>(null);
  const [integrantes, setIntegrantes] = useState<Membro[]>([]);
  const [tarefasFrente, setTarefasFrente] = useState<Tarefa[]>([]);
  const [tarefasIndividuais, setTarefasIndividuais] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const supabase = criarClienteNavegador();
    const frenteId = Number(id);

    async function carregar() {
      const [{ data: f }, { data: m }, { data: tf }] = await Promise.all([
        supabase.from("frentes").select("id, nome, criado_em").eq("id", frenteId).single(),
        supabase.from("membros").select("id, nome, papel, frente_id").eq("frente_id", frenteId).order("nome"),
        supabase
          .from("tarefas")
          .select("*, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel))")
          .eq("escopo", "frente")
          .eq("frente_id", frenteId)
          .eq("arquivada", false)
          .order("prazo", { ascending: true, nullsFirst: false }),
      ]);

      setFrente((f ?? null) as Frente | null);
      const integrantesDaFrente = (m ?? []) as Membro[];
      setIntegrantes(integrantesDaFrente);
      setTarefasFrente((tf ?? []) as Tarefa[]);

      if (integrantesDaFrente.length > 0) {
        const { data: ti } = await supabase
          .from("tarefas")
          .select("*, responsaveis:tarefa_responsaveis!inner(membro:membros(id, nome, papel))")
          .eq("escopo", "individual")
          .eq("arquivada", false)
          .in("tarefa_responsaveis.membro_id", integrantesDaFrente.map((m) => m.id))
          .order("prazo", { ascending: true, nullsFirst: false });
        setTarefasIndividuais((ti ?? []) as Tarefa[]);
      }

      setCarregando(false);
    }
    carregar();
  }, [id]);

  const porPessoa = useMemo(() => {
    const mapa = new Map<string, { nome: string; itens: Tarefa[] }>();
    tarefasIndividuais.forEach((t) => {
      const pessoa = responsaveisDe(t)[0];
      if (!pessoa) return;
      if (!mapa.has(pessoa.id)) mapa.set(pessoa.id, { nome: pessoa.nome, itens: [] });
      mapa.get(pessoa.id)!.itens.push(t);
    });
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [tarefasIndividuais]);

  if (carregando) return <p className="mt-10 font-mono text-sm text-tinta/50">carregando…</p>;

  if (!frente) {
    return (
      <div>
        <p className="text-sm text-tinta/60">Frente não encontrada.</p>
        <Link href="/frentes" className="mt-2 inline-block text-sm underline">← voltar pra Frentes</Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/frentes" className="font-mono text-xs text-tinta/50 underline underline-offset-4">
        ← Frentes
      </Link>
      <p className="mt-3 font-mono text-xs uppercase tracking-widest text-musgo">Frente</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">{frente.nome}</h1>
      <p className="mt-2 text-sm text-tinta/70">
        {integrantes.length === 0 ? "Ninguém nessa frente ainda." : integrantes.map((m) => m.nome).join(", ")}
      </p>

      <section className="mt-10">
        <h2 className="mb-3 border-b border-linha pb-1 font-display text-lg font-semibold">
          Tarefas da frente
          <span className="ml-2 font-mono text-xs font-normal text-tinta/50">{tarefasFrente.length}</span>
        </h2>
        <p className="mb-3 text-xs text-tinta/50">Trabalho conjunto — pertence à frente inteira.</p>
        {tarefasFrente.length === 0 ? (
          <p className="text-sm text-tinta/50">Nenhuma tarefa de frente ainda.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tarefasFrente.map((t) => <CartaoTarefa key={t.id} tarefa={t} />)}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 border-b border-linha pb-1 font-display text-lg font-semibold">
          Trabalho individual dos integrantes
          <span className="ml-2 font-mono text-xs font-normal text-tinta/50">{tarefasIndividuais.length}</span>
        </h2>
        <p className="mb-3 text-xs text-tinta/50">
          Não fica escondido: conta pro relatório final e pra validação dos professores.
        </p>
        {porPessoa.length === 0 ? (
          <p className="text-sm text-tinta/50">Ninguém tem tarefa individual ainda.</p>
        ) : (
          <div className="space-y-8">
            {porPessoa.map((p) => (
              <div key={p.nome}>
                <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-tinta/60">{p.nome}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {p.itens.map((t) => <CartaoTarefa key={t.id} tarefa={t} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
