"use client";

import { useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { PAPEIS, type Membro } from "@/lib/types";

export default function Equipe() {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = criarClienteNavegador();

    async function carregar() {
      const [{ data: sessao }, { data: lista }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("membros").select("id, nome, papel, criado_em").order("nome"),
      ]);
      setMeuId(sessao.user?.id ?? null);
      setMembros((lista ?? []) as Membro[]);
      setCarregando(false);
    }
    carregar();
  }, []);

  async function mudarPapel(id: string, papel: string) {
    setSalvandoId(id);
    setMembros((atual) => atual.map((m) => (m.id === id ? { ...m, papel } : m)));
    await criarClienteNavegador().from("membros").update({ papel }).eq("id", id);
    setSalvandoId(null);
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-musgo">Equipe</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
        Quem está no time
      </h1>
      <p className="mt-2 max-w-prose text-sm text-tinta/70">
        A lista vem de quem já criou conta em <span className="font-mono text-xs">/login</span>.
        Cada integrante escolhe o próprio papel — ninguém edita o papel de outra pessoa.
      </p>

      {carregando ? (
        <p className="mt-10 font-mono text-sm text-tinta/50">carregando…</p>
      ) : (
        <div className="mt-8 divide-y divide-linha border border-linha bg-casca">
          {membros.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {m.nome}
                {m.id === meuId && <span className="ml-2 font-mono text-[10px] text-musgo">(você)</span>}
              </span>

              {m.id === meuId ? (
                <select
                  value={m.papel}
                  disabled={salvandoId === m.id}
                  onChange={(e) => mudarPapel(m.id, e.target.value)}
                  className="border border-linha bg-campo px-2 py-1 font-mono text-xs uppercase disabled:opacity-50"
                >
                  {PAPEIS.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              ) : (
                <span className="bg-linha px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-tinta">
                  {PAPEIS.find((p) => p.id === m.papel)?.nome ?? m.papel}
                </span>
              )}

              {m.criado_em && (
                <span className="font-mono text-[11px] text-tinta/50">
                  entrou em {new Date(m.criado_em).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          ))}
          {membros.length === 0 && (
            <p className="px-4 py-6 text-sm text-tinta/50">
              Ninguém se cadastrou ainda. Peça pra equipe criar conta em /login.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
