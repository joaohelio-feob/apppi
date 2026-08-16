"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import type { Frente, Membro } from "@/lib/types";

export default function Frentes() {
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nomeNova, setNomeNova] = useState("");
  const [criando, setCriando] = useState(false);

  const supabase = criarClienteNavegador();

  async function carregar() {
    const [{ data: f }, { data: m }] = await Promise.all([
      supabase.from("frentes").select("id, nome, criado_em").order("nome"),
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
    await supabase.from("frentes").insert({ nome: nomeNova });
    setNomeNova("");
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
        ganha as tarefas antigas.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={nomeNova}
          onChange={(e) => setNomeNova(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && criar()}
          placeholder="Nome da nova frente"
          className="min-w-[200px] flex-1 border border-linha bg-casca px-3 py-2 text-sm"
        />
        <button
          onClick={criar}
          disabled={criando || !nomeNova.trim()}
          className="bg-tinta px-4 py-2 text-sm font-semibold text-campo hover:bg-musgo disabled:opacity-50"
        >
          {criando ? "Criando…" : "Nova frente"}
        </button>
      </div>

      {carregando ? (
        <p className="mt-10 font-mono text-sm text-tinta/50">carregando…</p>
      ) : (
        <div className="mt-8 divide-y divide-linha border border-linha bg-casca">
          {frentes.map((f) => {
            const integrantes = membros.filter((m) => m.frente_id === f.id);
            return (
              <Link
                key={f.id}
                href={`/frentes/${f.id}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-campo"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{f.nome}</span>
                <span className="font-mono text-[11px] text-tinta/50">
                  {integrantes.length === 0
                    ? "ninguém ainda"
                    : integrantes.map((m) => m.nome).join(", ")}
                </span>
              </Link>
            );
          })}
          {frentes.length === 0 && (
            <p className="px-4 py-6 text-sm text-tinta/50">Nenhuma frente criada ainda.</p>
          )}
        </div>
      )}
    </div>
  );
}
