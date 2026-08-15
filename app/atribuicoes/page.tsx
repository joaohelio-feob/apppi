"use client";

import { useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { STATUS, type Membro, type Tarefa } from "@/lib/types";

export default function Atribuicoes() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");

  const supabase = criarClienteNavegador();

  async function carregar() {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase
        .from("tarefas")
        .select("*, membros:responsavel_id(id, nome, papel)")
        .order("prazo", { ascending: true, nullsFirst: false }),
      supabase.from("membros").select("id, nome, papel").order("nome"),
    ]);
    setTarefas((t ?? []) as Tarefa[]);
    setMembros((m ?? []) as Membro[]);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function atualizarLocal(id: number, campos: Partial<Tarefa>) {
    setTarefas((atual) => atual.map((t) => (t.id === id ? { ...t, ...campos } : t)));
  }

  async function salvarCampo(id: number, campo: string, valor: string | null) {
    await supabase.from("tarefas").update({ [campo]: valor }).eq("id", id);
  }

  async function remover(id: number) {
    if (!confirm("Remover esta atribuição? Fica registrado na trilha.")) return;
    setTarefas((atual) => atual.filter((t) => t.id !== id));
    await supabase.from("tarefas").delete().eq("id", id);
  }

  async function adicionar() {
    if (!novoTitulo.trim()) return;
    setCriando(true);
    const { data: sessao } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("tarefas")
      .insert({ titulo: novoTitulo, criador_id: sessao.user?.id ?? null })
      .select("*, membros:responsavel_id(id, nome, papel)")
      .single();
    if (data) setTarefas((atual) => [data as Tarefa, ...atual]);
    setNovoTitulo("");
    setCriando(false);
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-musgo">Atribuições</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
        Quem faz o quê, até quando, e onde entrega
      </h1>
      <p className="mt-2 max-w-prose text-sm text-tinta/70">
        Tabela para planejar rápido. Editar aqui é a mesma tarefa do Quadro — muda ali também.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          className="min-w-[240px] flex-1 border border-linha bg-casca px-3 py-2 text-sm"
          placeholder="Título da nova tarefa"
          value={novoTitulo}
          onChange={(e) => setNovoTitulo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionar()}
        />
        <button
          onClick={adicionar}
          disabled={criando || !novoTitulo.trim()}
          className="bg-tinta px-4 py-2 text-sm font-semibold text-campo hover:bg-musgo disabled:opacity-50"
        >
          {criando ? "Criando…" : "Nova atribuição"}
        </button>
      </div>

      {carregando ? (
        <p className="mt-10 font-mono text-sm text-tinta/50">carregando…</p>
      ) : (
        <div className="mt-6 overflow-x-auto border border-linha">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-linha bg-casca font-mono text-[11px] uppercase tracking-wide text-tinta/60">
                <th className="px-3 py-2 text-left">Tarefa</th>
                <th className="px-3 py-2 text-left">Responsável</th>
                <th className="px-3 py-2 text-left">Dia</th>
                <th className="px-3 py-2 text-left">Local de entrega</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {tarefas.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2">
                    <input
                      defaultValue={t.titulo}
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value !== t.titulo) {
                          atualizarLocal(t.id, { titulo: e.target.value });
                          salvarCampo(t.id, "titulo", e.target.value);
                        }
                      }}
                      className="w-full min-w-[180px] border border-transparent bg-transparent px-1 py-1 hover:border-linha focus:border-linha focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={t.responsavel_id ?? ""}
                      onChange={(e) => {
                        const id = e.target.value || null;
                        const membro = membros.find((m) => m.id === id) ?? null;
                        atualizarLocal(t.id, { responsavel_id: id, membros: membro });
                        salvarCampo(t.id, "responsavel_id", id);
                      }}
                      className="border border-linha bg-campo px-2 py-1 font-corpo text-sm"
                    >
                      <option value="">sem dono</option>
                      {membros.map((m) => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={t.prazo ?? ""}
                      onChange={(e) => {
                        const valor = e.target.value || null;
                        atualizarLocal(t.id, { prazo: valor });
                        salvarCampo(t.id, "prazo", valor);
                      }}
                      className="border border-linha bg-campo px-2 py-1 font-mono text-xs"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      defaultValue={t.local_entrega ?? ""}
                      placeholder="link…"
                      onBlur={(e) => {
                        const valor = e.target.value || null;
                        if (valor !== t.local_entrega) {
                          atualizarLocal(t.id, { local_entrega: valor });
                          salvarCampo(t.id, "local_entrega", valor);
                        }
                      }}
                      className="w-full min-w-[160px] border border-transparent bg-transparent px-1 py-1 hover:border-linha focus:border-linha focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={t.status}
                      onChange={(e) => {
                        const valor = e.target.value as Tarefa["status"];
                        atualizarLocal(t.id, { status: valor });
                        salvarCampo(t.id, "status", valor);
                      }}
                      className="border border-linha bg-campo px-2 py-1 font-mono text-[11px] uppercase"
                    >
                      {STATUS.map((s) => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => remover(t.id)}
                      className="font-mono text-[11px] text-tinta/40 hover:text-trigo"
                    >
                      remover
                    </button>
                  </td>
                </tr>
              ))}
              {tarefas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-tinta/50">
                    Nenhuma atribuição ainda. Crie a primeira acima.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
