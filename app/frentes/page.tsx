"use client";

import AvisoErro from "@/components/ui/AvisoErro";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import GuiaDidatico from "@/components/ui/GuiaDidatico";
import Botao from "@/components/ui/Botao";
import { useEffect, useState } from "react";
import Link from "next/link";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import {
  CLASSES_COR_FRENTE,
  CLASSES_COR_FRENTE_PREENCHIDA,
  CORES_FRENTE,
  UNIDADES_FRENTE,
  iniciaisDe,
  type CorFrente,
  type Frente,
  type Membro,
  type Unidade,
} from "@/lib/types";
import {
  IconeFrentes,
  IconeMais,
  IconeSetaDireita,
} from "@/components/ui/Icones";

type FrenteComMembros = Frente & { membros?: Membro[] };

export default function Frentes() {
  const [erroCarga, setErroCarga] = useState(false);
  const [frentes, setFrentes] = useState<FrenteComMembros[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [nomeNova, setNomeNova] = useState("");
  const [unidadeNova, setUnidadeNova] = useState<Unidade | "">("");
  const [corNova, setCorNova] = useState<CorFrente>("ferro");
  const [ordemNova, setOrdemNova] = useState("0");
  const [erroCriacao, setErroCriacao] = useState(false);
  const [criando, setCriando] = useState(false);

  const supabase = criarClienteNavegador();

  async function carregar() {
    const { data: f, error } = await supabase
      .from("frentes")
      .select("id, nome, unidade, cor, ordem, criado_em, membros(id, nome)")
      .order("ordem");
    setErroCarga(!!error);
    if (error) {
      setCarregando(false);
      return;
    }
    setFrentes((f ?? []) as unknown as FrenteComMembros[]);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function criar() {
    if (!nomeNova.trim()) return;
    setCriando(true);
    setErroCriacao(false);
    const { error } = await supabase.from("frentes").insert({
      nome: nomeNova,
      unidade: unidadeNova || null,
      cor: corNova,
      ordem: Number(ordemNova) || 0,
    });
    if (error) {
      setErroCriacao(true);
      setCriando(false);
      return;
    }
    setNomeNova("");
    setUnidadeNova("");
    setCorNova("ferro");
    setOrdemNova("0");
    setCriando(false);
    carregar();
  }

  return (
    <div>
      <CabecalhoPagina
        categoria="Sub-times e matérias"
        icone={<IconeFrentes className="h-3.5 w-3.5 text-musgo" />}
        titulo="Frentes"
        contagem={!carregando ? `${frentes.length} frentes` : undefined}
        descricao="Cada frente reúne os integrantes responsáveis por uma unidade de estudo do Projeto Integrador."
      />

      <GuiaDidatico
        titulo="Como as frentes funcionam com tarefas e matérias?"
        resumo="Entenda a atribuição automática e a ligação com POO, Lógica, Modelagem, BI e Autoconhecimento."
        className="mb-6"
      >
        <ul className="space-y-1.5 text-xs leading-relaxed text-tinta/70">
          <li>
            • Cada integrante entra numa frente em{" "}
            <Link href="/equipe" className="font-semibold text-musgo underline">
              Equipe
            </Link>
            .
          </li>
          <li>
            • Tarefa com escopo <strong className="text-tinta">Da frente</strong>{" "}
            atribui automaticamente todo mundo que já está nela no momento da
            criação (não é retroativo para quem entrar depois).
          </li>
          <li>
            • A <strong className="text-tinta">unidade de estudo</strong>{" "}
            comprova nos relatórios que todas as disciplinas do PI foram
            trabalhadas.
          </li>
        </ul>
      </GuiaDidatico>

      <div className="cartao mb-6 p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-tinta">
            Criar nova frente
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-linha bg-campo px-2.5 py-0.5 text-xs text-tinta">
            <span
              className={`h-2.5 w-2.5 rounded-full ${CLASSES_COR_FRENTE_PREENCHIDA[corNova]}`}
            />
            Preview: {CORES_FRENTE.find((c) => c.id === corNova)?.nome}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[200px] flex-1 text-xs font-semibold text-tinta/70">
            Nome da frente
            <input
              aria-label="Nome da nova frente"
              value={nomeNova}
              onChange={(e) => setNomeNova(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && criar()}
              placeholder="Ex.: Banco de Dados & BI"
              className="campo mt-1"
            />
          </label>
          <label className="text-xs font-semibold text-tinta/70">
            Unidade do PI
            <select
              aria-label="Unidade de estudo"
              value={unidadeNova}
              onChange={(e) => setUnidadeNova(e.target.value as Unidade)}
              className="campo mt-1 text-xs"
            >
              <option value="">Sem unidade</option>
              {UNIDADES_FRENTE.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-tinta/70">
            Cor
            <select
              aria-label="Cor da frente"
              value={corNova}
              onChange={(e) => setCorNova(e.target.value as CorFrente)}
              className="campo mt-1 text-xs"
            >
              {CORES_FRENTE.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-tinta/70">
            Ordem
            <input
              type="number"
              value={ordemNova}
              onChange={(e) => setOrdemNova(e.target.value)}
              className="campo mt-1 w-20 font-mono"
            />
          </label>
          <Botao
            variante="destaque"
            onClick={criar}
            disabled={criando || !nomeNova.trim()}
          >
            <IconeMais className="h-4 w-4" />
            {criando ? "Criando…" : "Nova frente"}
          </Botao>
        </div>
      </div>

      {erroCriacao && (
        <AvisoErro mensagem="Não foi possível criar a frente. Confira os campos e tente novamente." />
      )}
      {erroCarga && (
        <AvisoErro
          mensagem="Não foi possível carregar os dados. Tente novamente."
          aoTentar={carregar}
        />
      )}
      {carregando ? (
        <p className="mt-10 text-sm text-tinta/70">Carregando frentes…</p>
      ) : erroCarga ? null : frentes.length === 0 ? (
        <div className="cartao p-8 text-center text-sm text-tinta/70">
          Nenhuma frente criada ainda.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {frentes.map((f) => {
            const integrantes = f.membros ?? [];
            const nomeUnidade = UNIDADES_FRENTE.find(
              (u) => u.id === f.unidade,
            )?.nome;
            return (
              <Link
                key={f.id}
                href={`/frentes/${f.id}`}
                className={`cartao flex flex-col justify-between border-l-4 p-5 transition-[transform,box-shadow] duration-micro ease-entrada hover:-translate-y-0.5 hover:shadow-cartao-hover ${
                  CLASSES_COR_FRENTE[f.cor ?? "ferro"]
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-3 w-3 shrink-0 rounded-full ${
                          CLASSES_COR_FRENTE_PREENCHIDA[f.cor ?? "ferro"]
                        }`}
                      />
                      <h2 className="truncate font-display text-lg font-bold text-tinta">
                        {f.nome}
                      </h2>
                    </div>
                    {nomeUnidade && (
                      <span className="shrink-0 rounded-full border border-linha bg-campo px-2.5 py-0.5 font-mono text-xs font-semibold text-tinta">
                        {nomeUnidade}
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    {integrantes.length === 0 ? (
                      <p className="text-xs text-tinta/70">
                        Nenhum integrante nesta frente ainda.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {integrantes.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1 rounded-full border border-linha bg-campo px-2 py-0.5 text-xs font-medium text-tinta"
                          >
                            <span
                              className={`inline-flex h-4 w-4 items-center justify-center rounded-full font-mono text-xs text-campo ${
                                CLASSES_COR_FRENTE_PREENCHIDA[f.cor ?? "ferro"]
                              }`}
                            >
                              {iniciaisDe(m.nome).slice(0, 1)}
                            </span>
                            {m.nome}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-linha/80 pt-3 text-xs font-semibold text-tinta">
                  <span className="font-mono text-tinta/70">
                    {integrantes.length}{" "}
                    {integrantes.length === 1 ? "integrante" : "integrantes"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-musgo">
                    Abrir frente
                    <IconeSetaDireita className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
