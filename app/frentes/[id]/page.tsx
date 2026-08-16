"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { UNIDADES_FRENTE, CORES_FRENTE, responsaveisDe, type CorFrente, type Frente, type Membro, type Tarefa, type Unidade } from "@/lib/types";
import CartaoTarefa from "@/components/CartaoTarefa";

export default function PainelFrente() {
  const { id } = useParams<{ id: string }>();
  const [frente, setFrente] = useState<Frente | null>(null);
  const [integrantes, setIntegrantes] = useState<Membro[]>([]);
  const [tarefasFrente, setTarefasFrente] = useState<Tarefa[]>([]);
  const [tarefasIndividuais, setTarefasIndividuais] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const supabase = criarClienteNavegador();
    const frenteId = Number(id);

    async function carregar() {
      const [{ data: f }, { data: tf }] = await Promise.all([
        // Membros vêm embutidos (FK reversa) em vez de uma consulta à parte.
        supabase
          .from("frentes")
          .select("id, nome, unidade, cor, ordem, criado_em, membros(id, nome, papel, frente_id)")
          .eq("id", frenteId)
          .order("nome", { foreignTable: "membros" })
          .single(),
        supabase
          .from("tarefas")
          .select("id, titulo, descricao, escopo, status, prioridade, prazo, local_entrega, subiu_git, issue_numero, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, cor, unidade)")
          .eq("escopo", "frente")
          .eq("frente_id", frenteId)
          .eq("arquivada", false)
          .order("prazo", { ascending: true, nullsFirst: false }),
      ]);

      setFrente((f ?? null) as Frente | null);
      const integrantesDaFrente = ((f as { membros?: Membro[] } | null)?.membros ?? []) as Membro[];
      setIntegrantes(integrantesDaFrente);
      setTarefasFrente((tf ?? []) as unknown as Tarefa[]);

      if (integrantesDaFrente.length > 0) {
        const { data: ti } = await supabase
          .from("tarefas")
          .select("id, titulo, descricao, escopo, status, prioridade, prazo, local_entrega, subiu_git, issue_numero, responsaveis:tarefa_responsaveis!inner(membro:membros(id, nome, papel)), frentes(id, nome, cor, unidade)")
          .eq("escopo", "individual")
          .eq("arquivada", false)
          .in("tarefa_responsaveis.membro_id", integrantesDaFrente.map((m) => m.id))
          .order("prazo", { ascending: true, nullsFirst: false });
        setTarefasIndividuais((ti ?? []) as unknown as Tarefa[]);
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

  async function salvarEdicao(campos: Partial<Pick<Frente, "nome" | "unidade" | "cor" | "ordem">>) {
    if (!frente) return;
    setSalvando(true);
    const atualizado = { ...frente, ...campos };
    setFrente(atualizado);
    await criarClienteNavegador().from("frentes").update(campos).eq("id", frente.id);
    setSalvando(false);
  }

  if (carregando) return <p className="mt-10 font-mono text-sm text-tinta/70">carregando…</p>;

  if (!frente) {
    return (
      <div>
        <p className="text-sm text-tinta/70">Frente não encontrada.</p>
        <Link href="/frentes" className="mt-2 inline-block text-sm underline">← voltar pra Frentes</Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/frentes" className="font-mono text-xs text-tinta/70 underline underline-offset-4">
        ← Frentes
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-musgo">
            Frente{UNIDADES_FRENTE.find((u) => u.id === frente.unidade)?.nome ? ` · ${UNIDADES_FRENTE.find((u) => u.id === frente.unidade)?.nome}` : ""}
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">{frente.nome}</h1>
        </div>
        <button
          onClick={() => setEditando((a) => !a)}
          className="font-mono text-xs text-tinta/70 underline underline-offset-4 hover:text-tinta"
        >
          {editando ? "fechar edição" : "editar"}
        </button>
      </div>
      <p className="mt-2 text-sm text-tinta/70">
        {integrantes.length === 0 ? "Ninguém nessa frente ainda." : integrantes.map((m) => m.nome).join(", ")}
      </p>

      {editando && (
        <div className="mt-4 flex flex-wrap items-end gap-2 border border-linha bg-casca p-3">
          <label className="font-mono text-xs uppercase text-tinta/70">
            Nome
            <input
              defaultValue={frente.nome}
              onBlur={(e) => e.target.value.trim() && e.target.value !== frente.nome && salvarEdicao({ nome: e.target.value })}
              className="mt-1 block min-w-[160px] border border-linha bg-campo px-3 py-2 font-corpo text-sm normal-case text-tinta"
            />
          </label>
          <label className="font-mono text-xs uppercase text-tinta/70">
            Unidade
            <select
              value={frente.unidade ?? ""}
              disabled={salvando}
              onChange={(e) => salvarEdicao({ unidade: (e.target.value || null) as Unidade | null })}
              className="mt-1 block border border-linha bg-campo px-2 py-2 font-mono text-xs uppercase disabled:opacity-50"
            >
              <option value="">Sem unidade</option>
              {UNIDADES_FRENTE.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </label>
          <label className="font-mono text-xs uppercase text-tinta/70">
            Cor
            <select
              value={frente.cor}
              disabled={salvando}
              onChange={(e) => salvarEdicao({ cor: e.target.value as CorFrente })}
              className="mt-1 block border border-linha bg-campo px-2 py-2 font-mono text-xs uppercase disabled:opacity-50"
            >
              {CORES_FRENTE.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
          <label className="font-mono text-xs uppercase text-tinta/70">
            Ordem
            <input
              type="number"
              defaultValue={frente.ordem}
              disabled={salvando}
              onBlur={(e) => salvarEdicao({ ordem: Number(e.target.value) || 0 })}
              className="mt-1 block w-16 border border-linha bg-campo px-2 py-2 font-mono text-sm disabled:opacity-50"
            />
          </label>
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-3 border-b border-linha pb-1 font-display text-lg font-semibold">
          Tarefas da frente
          <span className="ml-2 font-mono text-xs font-normal text-tinta/70">{tarefasFrente.length}</span>
        </h2>
        <p className="mb-3 text-xs text-tinta/70">Trabalho conjunto — pertence à frente inteira.</p>
        {tarefasFrente.length === 0 ? (
          <p className="text-sm text-tinta/70">Nenhuma tarefa de frente ainda.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tarefasFrente.map((t) => <CartaoTarefa key={t.id} tarefa={t} />)}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 border-b border-linha pb-1 font-display text-lg font-semibold">
          Trabalho individual dos integrantes
          <span className="ml-2 font-mono text-xs font-normal text-tinta/70">{tarefasIndividuais.length}</span>
        </h2>
        <p className="mb-3 text-xs text-tinta/70">
          Não fica escondido: conta pro relatório final e pra validação dos professores.
        </p>
        {porPessoa.length === 0 ? (
          <p className="text-sm text-tinta/70">Ninguém tem tarefa individual ainda.</p>
        ) : (
          <div className="space-y-8">
            {porPessoa.map((p) => (
              <div key={p.nome}>
                <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-tinta/70">{p.nome}</h3>
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
