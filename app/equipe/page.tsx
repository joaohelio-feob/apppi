"use client";

import { useToast } from "@/components/ToastProvider";
import AvisoErro from "@/components/ui/AvisoErro";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import { useEffect, useState } from "react";
import Link from "next/link";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { PAPEIS, iniciaisDe, type Frente, type Membro } from "@/lib/types";
import { dataCurta } from "@/lib/datas";
import { IconeEquipe, IconeSetaDireita } from "@/components/ui/Icones";

export default function Equipe() {
  const { avisar } = useToast();
  const [erroCarga, setErroCarga] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = criarClienteNavegador();

    async function carregar() {
      const [
        { data: sessao },
        { data: lista, error: erroLista },
        { data: listaFrentes, error: erroFrentes },
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("membros")
          .select("id, nome, papel, frente_id, criado_em")
          .order("nome"),
        supabase.from("frentes").select("id, nome").order("nome"),
      ]);
      setErroCarga(!!(erroLista || erroFrentes));
      if (erroLista || erroFrentes) {
        setCarregando(false);
        return;
      }
      setMeuId(sessao.user?.id ?? null);
      setMembros((lista ?? []) as Membro[]);
      setFrentes((listaFrentes ?? []) as Frente[]);
      setCarregando(false);
    }
    carregar();
  }, []);

  async function mudarPapel(id: string, papel: string) {
    const anterior = membros.find((m) => m.id === id);
    setSalvandoId(id);
    setMembros((atual) =>
      atual.map((m) => (m.id === id ? { ...m, papel } : m)),
    );
    const { error } = await criarClienteNavegador()
      .from("membros")
      .update({ papel })
      .eq("id", id);
    if (error) {
      if (anterior)
        setMembros((lista) => lista.map((m) => (m.id === id ? anterior : m)));
      avisar("Não foi possível salvar o papel.");
    }
    setSalvandoId(null);
  }

  async function mudarFrente(id: string, frenteId: string) {
    const anterior = membros.find((m) => m.id === id);
    setSalvandoId(id);
    const valor = frenteId ? Number(frenteId) : null;
    setMembros((atual) =>
      atual.map((m) => (m.id === id ? { ...m, frente_id: valor } : m)),
    );
    const { error } = await criarClienteNavegador()
      .from("membros")
      .update({ frente_id: valor })
      .eq("id", id);
    if (error) {
      if (anterior)
        setMembros((lista) => lista.map((m) => (m.id === id ? anterior : m)));
      avisar("Não foi possível salvar a frente.");
    }
    setSalvandoId(null);
  }

  return (
    <div>
      <CabecalhoPagina
        categoria="Gestão da equipe"
        icone={<IconeEquipe className="h-3.5 w-3.5 text-musgo" />}
        titulo="Equipe"
        contagem={!carregando ? `${membros.length} integrantes` : undefined}
        descricao={
          <>
            A lista vem de quem criou conta em{" "}
            <span className="font-mono text-xs">/login</span>. Cada integrante
            escolhe o próprio papel e frente — ninguém edita o perfil de outra
            pessoa.
          </>
        }
      />

      {erroCarga && (
        <AvisoErro mensagem="Não foi possível carregar os dados. Tente novamente." />
      )}
      {carregando ? (
        <p className="mt-10 text-sm text-tinta/70">Carregando equipe…</p>
      ) : erroCarga ? null : membros.length === 0 ? (
        <div className="cartao p-8 text-center text-sm text-tinta/70">
          Ninguém se cadastrou ainda. Peça pra equipe criar conta em /login.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {membros.map((m) => {
            const souEu = m.id === meuId;
            const nomePapel =
              PAPEIS.find((p) => p.id === m.papel)?.nome ?? m.papel;
            const nomeFrente =
              frentes.find((f) => f.id === m.frente_id)?.nome ?? "sem frente";
            return (
              <article
                key={m.id}
                className={`cartao flex flex-col justify-between p-5 ${
                  souEu ? "border-l-4 border-l-broto" : ""
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-musgo font-mono text-sm font-bold text-campo shadow-cartao"
                      >
                        {iniciaisDe(m.nome)}
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-base font-bold text-tinta">
                          {m.nome}
                        </h2>
                        {m.criado_em && (
                          <p className="font-mono text-xs text-tinta/70">
                            entrou em {dataCurta(m.criado_em)}
                          </p>
                        )}
                      </div>
                    </div>
                    {souEu && (
                      <span className="rounded-full bg-broto/25 px-2.5 py-0.5 font-mono text-xs font-semibold text-tinta">
                        você
                      </span>
                    )}
                  </div>

                  {souEu ? (
                    <div className="mt-4 grid gap-2.5">
                      <label className="block text-xs font-semibold text-tinta/70">
                        Seu papel
                        <select
                          aria-label={`Papel de ${m.nome}`}
                          value={m.papel}
                          disabled={salvandoId === m.id}
                          onChange={(e) => mudarPapel(m.id, e.target.value)}
                          className="campo mt-1 py-1.5 text-xs"
                        >
                          {PAPEIS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold text-tinta/70">
                        Sua frente
                        <select
                          aria-label={`Frente de ${m.nome}`}
                          value={m.frente_id ?? ""}
                          disabled={salvandoId === m.id}
                          onChange={(e) => mudarFrente(m.id, e.target.value)}
                          className="campo mt-1 py-1.5 text-xs"
                        >
                          <option value="">sem frente</option>
                          {frentes.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-linha bg-casca px-2.5 py-0.5 text-xs font-medium text-tinta">
                        {nomePapel}
                      </span>
                      <span className="rounded-full border border-linha bg-campo px-2.5 py-0.5 font-mono text-xs text-tinta/70">
                        {nomeFrente}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-linha/80 pt-3">
                  <Link
                    href={`/equipe/${m.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-musgo underline-offset-4 hover:text-tinta hover:underline"
                  >
                    Ver painel individual
                    <IconeSetaDireita className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
