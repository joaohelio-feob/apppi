"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { CLASSES_COR_FRENTE_PREENCHIDA, CORES_FRENTE, UNIDADES_FRENTE, type CorFrente, type Frente, type Membro, type Unidade } from "@/lib/types";

export default function Frentes() {
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [nomeNova, setNomeNova] = useState("");
  const [unidadeNova, setUnidadeNova] = useState<Unidade | "">("");
  const [corNova, setCorNova] = useState<CorFrente>("ferro");
  const [ordemNova, setOrdemNova] = useState("0");
  const [criando, setCriando] = useState(false);

  const supabase = criarClienteNavegador();

  async function carregar() {
    const [{ data: f }, { data: m }] = await Promise.all([
      supabase.from("frentes").select("id, nome, unidade, cor, ordem, criado_em").order("ordem"),
      supabase.from("membros").select("id, nome, papel, frente_id"),
    ]);
    setFrentes((f ?? []) as Frente[]);
    setMembros((m ?? []) as Membro[]);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function criar() {
    if (!nomeNova.trim()) return;
    setCriando(true);
    await supabase.from("frentes").insert({
      nome: nomeNova,
      unidade: unidadeNova || null,
      cor: corNova,
      ordem: Number(ordemNova) || 0,
    });
    setNomeNova("");
    setUnidadeNova("");
    setCorNova("ferro");
    setOrdemNova("0");
    setCriando(false);
    carregar();
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-musgo">Frentes</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
        Os sub-times do projeto
      </h1>
      <p className="mt-2 max-w-prose text-sm text-tinta/70">
        Cada integrante entra numa frente em <Link href="/equipe" className="underline">Equipe</Link>.
        Tarefa de frente atribui todo mundo que já está nela na hora — quem entra depois não
        ganha as tarefas antigas. A unidade de estudo liga a frente à matéria correspondente do PI.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-2 border border-linha bg-casca p-3">
        <input
          value={nomeNova}
          onChange={(e) => setNomeNova(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && criar()}
          placeholder="Nome da nova frente"
          className="min-w-[180px] flex-1 border border-linha bg-campo px-3 py-2 text-sm"
        />
        <select
          value={unidadeNova}
          onChange={(e) => setUnidadeNova(e.target.value as Unidade)}
          className="border border-linha bg-campo px-2 py-2 font-mono text-xs uppercase"
        >
          <option value="">Sem unidade</option>
          {UNIDADES_FRENTE.map((u) => (
            <option key={u.id} value={u.id}>{u.nome}</option>
          ))}
        </select>
        <select
          value={corNova}
          onChange={(e) => setCorNova(e.target.value as CorFrente)}
          className="border border-linha bg-campo px-2 py-2 font-mono text-xs uppercase"
        >
          {CORES_FRENTE.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        <label className="font-mono text-xs uppercase text-tinta/70">
          Ordem
          <input
            type="number"
            value={ordemNova}
            onChange={(e) => setOrdemNova(e.target.value)}
            className="mt-1 block w-16 border border-linha bg-campo px-2 py-2 font-mono text-sm"
          />
        </label>
        <button
          onClick={criar}
          disabled={criando || !nomeNova.trim()}
          className="bg-tinta px-4 py-2 text-sm font-semibold text-campo hover:bg-musgo disabled:opacity-50"
        >
          {criando ? "Criando…" : "Nova frente"}
        </button>
      </div>

      {carregando ? (
        <p className="mt-10 font-mono text-sm text-tinta/70">carregando…</p>
      ) : (
        <div className="mt-8 divide-y divide-linha border border-linha bg-casca">
          {frentes.map((f) => {
            const integrantes = membros.filter((m) => m.frente_id === f.id);
            const nomeUnidade = UNIDADES_FRENTE.find((u) => u.id === f.unidade)?.nome;
            return (
              <Link
                key={f.id}
                href={`/frentes/${f.id}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-campo"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${CLASSES_COR_FRENTE_PREENCHIDA[f.cor]}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{f.nome}</p>
                  {nomeUnidade && (
                    <p className="font-mono text-xs text-tinta/70">{nomeUnidade}</p>
                  )}
                </div>
                <span className="font-mono text-xs text-tinta/70">
                  {integrantes.length === 0
                    ? "ninguém ainda"
                    : integrantes.map((m) => m.nome).join(", ")}
                </span>
              </Link>
            );
          })}
          {frentes.length === 0 && (
            <p className="px-4 py-6 text-sm text-tinta/70">Nenhuma frente criada ainda.</p>
          )}
        </div>
      )}
    </div>
  );
}
