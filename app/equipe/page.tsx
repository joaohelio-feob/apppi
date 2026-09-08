"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { PAPEIS, type Frente, type Membro } from "@/lib/types";
import { dataCurta } from "@/lib/datas";

export default function Equipe() {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = criarClienteNavegador();

    async function carregar() {
      const [{ data: sessao }, { data: lista }, { data: listaFrentes }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("membros").select("id, nome, papel, frente_id, criado_em").order("nome"),
        supabase.from("frentes").select("id, nome").order("nome"),
      ]);
      setMeuId(sessao.user?.id ?? null);
      setMembros((lista ?? []) as Membro[]);
      setFrentes((listaFrentes ?? []) as Frente[]);
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

  async function mudarFrente(id: string, frenteId: string) {
    setSalvandoId(id);
    const valor = frenteId ? Number(frenteId) : null;
    setMembros((atual) => atual.map((m) => (m.id === id ? { ...m, frente_id: valor } : m)));
    await criarClienteNavegador().from("membros").update({ frente_id: valor }).eq("id", id);
    setSalvandoId(null);
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        Quem está no time
      </h1>
      <p className="mt-2 max-w-prose text-sm text-tinta/70">
        A lista vem de quem já criou conta em <span className="font-mono text-xs">/login</span>.
        Cada integrante escolhe o próprio papel — ninguém edita o papel de outra pessoa.
      </p>

      {carregando ? (
        <p className="mt-10 text-sm text-tinta/70">carregando…</p>
      ) : (
        <div className="mt-8 divide-y divide-linha border border-linha bg-casca">
          {membros.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link
                href={`/equipe/${m.id}`}
                className="min-w-0 flex-1 truncate text-sm font-semibold underline-offset-4 hover:underline"
              >
                {m.nome}
                {m.id === meuId && <span className="ml-2 font-mono text-xs text-musgo">(você)</span>}
              </Link>

              {m.id === meuId ? (
                <>
                  <select
                    value={m.papel}
                    disabled={salvandoId === m.id}
                    onChange={(e) => mudarPapel(m.id, e.target.value)}
                    className="border border-linha bg-campo px-2 py-1 text-xs disabled:opacity-50"
                  >
                    {PAPEIS.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                  <select
                    value={m.frente_id ?? ""}
                    disabled={salvandoId === m.id}
                    onChange={(e) => mudarFrente(m.id, e.target.value)}
                    className="border border-linha bg-campo px-2 py-1 text-xs disabled:opacity-50"
                  >
                    <option value="">sem frente</option>
                    {frentes.map((f) => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <span className="bg-linha px-2 py-0.5 text-xs text-tinta">
                    {PAPEIS.find((p) => p.id === m.papel)?.nome ?? m.papel}
                  </span>
                  <span className="font-mono text-xs text-tinta/70">
                    {frentes.find((f) => f.id === m.frente_id)?.nome ?? "sem frente"}
                  </span>
                </>
              )}

              {m.criado_em && (
                <span className="font-mono text-xs text-tinta/70">
                  entrou em {dataCurta(m.criado_em)}
                </span>
              )}
            </div>
          ))}
          {membros.length === 0 && (
            <p className="px-4 py-6 text-sm text-tinta/70">
              Ninguém se cadastrou ainda. Peça pra equipe criar conta em /login.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
