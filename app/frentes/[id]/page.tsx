"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import {
  CLASSES_COR_FRENTE_PREENCHIDA,
  CORES_FRENTE,
  UNIDADES_FRENTE,
  iniciaisDe,
  responsaveisDe,
  type CorFrente,
  type Frente,
  type Membro,
  type Tarefa,
  type Unidade,
} from "@/lib/types";
import LinhaTarefa from "@/components/LinhaTarefa";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Botao from "@/components/ui/Botao";
import { IconeFrentes } from "@/components/ui/Icones";

const concluidaPorUltimo = (lista: Tarefa[]) =>
  [...lista].sort(
    (a, b) =>
      Number(a.status === "concluida") - Number(b.status === "concluida"),
  );

const CAMPOS_TAREFA =
  "id, titulo, descricao, escopo, frente_id, status, prioridade, prazo, inicio, local_entrega, subiu_git, issue_numero, observacoes";

export default function PainelFrente() {
  const { id } = useParams<{ id: string }>();
  const [frente, setFrente] = useState<Frente | null>(null);
  const [integrantes, setIntegrantes] = useState<Membro[]>([]);
  const [tarefasFrente, setTarefasFrente] = useState<Tarefa[]>([]);
  const [tarefasIndividuais, setTarefasIndividuais] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const supabase = criarClienteNavegador();
    const frenteId = Number(id);

    const [{ data: f }, { data: tf }] = await Promise.all([
      supabase
        .from("frentes")
        .select(
          "id, nome, unidade, cor, ordem, criado_em, membros(id, nome, papel, frente_id)",
        )
        .eq("id", frenteId)
        .order("nome", { foreignTable: "membros" })
        .single(),
      supabase
        .from("tarefas")
        .select(
          `${CAMPOS_TAREFA}, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, cor, unidade)`,
        )
        .eq("escopo", "frente")
        .eq("frente_id", frenteId)
        .eq("arquivada", false)
        .order("prazo", { ascending: true, nullsFirst: false }),
    ]);

    setFrente((f ?? null) as Frente | null);
    const integrantesDaFrente = ((f as { membros?: Membro[] } | null)?.membros ??
      []) as Membro[];
    setIntegrantes(integrantesDaFrente);
    setTarefasFrente((tf ?? []) as unknown as Tarefa[]);

    if (integrantesDaFrente.length > 0) {
      const { data: ti } = await supabase
        .from("tarefas")
        .select(
          `${CAMPOS_TAREFA}, responsaveis:tarefa_responsaveis!inner(membro:membros(id, nome, papel)), frentes(id, nome, cor, unidade)`,
        )
        .eq("escopo", "individual")
        .eq("arquivada", false)
        .in(
          "tarefa_responsaveis.membro_id",
          integrantesDaFrente.map((m) => m.id),
        )
        .order("prazo", { ascending: true, nullsFirst: false });
      setTarefasIndividuais((ti ?? []) as unknown as Tarefa[]);
    } else {
      setTarefasIndividuais([]);
    }

    setCarregando(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const { emAndamentoPorPessoa, individuaisConcluidas } = useMemo(() => {
    const mapa = new Map<string, { nome: string; itens: Tarefa[] }>();
    const concluidas: { nome: string; tarefa: Tarefa }[] = [];

    tarefasIndividuais.forEach((t) => {
      const pessoa = responsaveisDe(t)[0];
      if (!pessoa) return;
      if (t.status === "concluida") {
        concluidas.push({ nome: pessoa.nome, tarefa: t });
        return;
      }
      if (!mapa.has(pessoa.id))
        mapa.set(pessoa.id, { nome: pessoa.nome, itens: [] });
      mapa.get(pessoa.id)!.itens.push(t);
    });

    return {
      emAndamentoPorPessoa: Array.from(mapa.values()).sort((a, b) =>
        a.nome.localeCompare(b.nome),
      ),
      individuaisConcluidas: [...concluidas]
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((c) => c.tarefa),
    };
  }, [tarefasIndividuais]);

  async function salvarEdicao(
    campos: Partial<Pick<Frente, "nome" | "unidade" | "cor" | "ordem">>,
  ) {
    if (!frente) return;
    setSalvando(true);
    const atualizado = { ...frente, ...campos };
    setFrente(atualizado);
    await criarClienteNavegador()
      .from("frentes")
      .update(campos)
      .eq("id", frente.id);
    setSalvando(false);
  }

  const nomeUnidade =
    UNIDADES_FRENTE.find((u) => u.id === frente?.unidade)?.nome ?? null;

  const daFrenteOrdenadas = concluidaPorUltimo(tarefasFrente);
  const concluidasFrente = tarefasFrente.filter(
    (t) => t.status === "concluida",
  ).length;
  const concluidasIndividuais = tarefasIndividuais.filter(
    (t) => t.status === "concluida",
  ).length;

  if (carregando)
    return <p className="mt-10 text-sm text-tinta/70">Carregando frente…</p>;

  if (!frente) {
    return (
      <div className="cartao p-6">
        <p className="text-sm text-tinta/70">Frente não encontrada.</p>
        <Link
          href="/frentes"
          className="mt-2 inline-block text-sm font-semibold text-musgo underline"
        >
          ← voltar pra Frentes
        </Link>
      </div>
    );
  }

  const taxaFrente =
    tarefasFrente.length > 0
      ? Math.round((concluidasFrente / tarefasFrente.length) * 100)
      : 0;
  const taxaIndividuais =
    tarefasIndividuais.length > 0
      ? Math.round((concluidasIndividuais / tarefasIndividuais.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="cartao overflow-hidden p-5">
        <div
          className={`-mx-5 -mt-5 mb-4 h-2 ${CLASSES_COR_FRENTE_PREENCHIDA[frente.cor ?? "ferro"]}`}
        />
        <CabecalhoPagina
          voltar={{ href: "/frentes", rotulo: "Frentes" }}
          categoria={nomeUnidade ? `Unidade: ${nomeUnidade}` : "Frente do PI"}
          icone={<IconeFrentes className="h-3.5 w-3.5 text-musgo" />}
          titulo={frente.nome}
          acoes={
            <Botao
              variante="secundario"
              onClick={() => setEditando((a) => !a)}
            >
              {editando ? "Fechar edição" : "Editar frente"}
            </Botao>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-tinta/70">
            Integrantes:
          </span>
          {integrantes.length === 0 ? (
            <span className="text-xs text-tinta/70">
              Ninguém nessa frente ainda.
            </span>
          ) : (
            integrantes.map((m) => (
              <Link
                key={m.id}
                href={`/equipe/${m.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-linha bg-campo px-2.5 py-0.5 text-xs font-medium text-tinta hover:border-musgo hover:bg-casca"
              >
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full font-mono text-xs text-campo ${
                    CLASSES_COR_FRENTE_PREENCHIDA[frente.cor ?? "ferro"]
                  }`}
                >
                  {iniciaisDe(m.nome).slice(0, 1)}
                </span>
                {m.nome}
              </Link>
            ))
          )}
        </div>

        {editando && (
          <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-linha bg-campo/70 p-4">
            <label className="min-w-[180px] flex-1 text-xs font-semibold text-tinta/70">
              Nome
              <input
                defaultValue={frente.nome}
                onBlur={(e) =>
                  e.target.value.trim() &&
                  e.target.value !== frente.nome &&
                  salvarEdicao({ nome: e.target.value })
                }
                className="campo mt-1"
              />
            </label>
            <label className="text-xs font-semibold text-tinta/70">
              Unidade
              <select
                value={frente.unidade ?? ""}
                disabled={salvando}
                onChange={(e) =>
                  salvarEdicao({
                    unidade: (e.target.value || null) as Unidade | null,
                  })
                }
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
                value={frente.cor}
                disabled={salvando}
                onChange={(e) =>
                  salvarEdicao({ cor: e.target.value as CorFrente })
                }
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
                defaultValue={frente.ordem}
                disabled={salvando}
                onBlur={(e) =>
                  salvarEdicao({ ordem: Number(e.target.value) || 0 })
                }
                className="campo mt-1 w-20 font-mono"
              />
            </label>
          </div>
        )}
      </div>

      {/* Tarefas da frente */}
      <section className="cartao p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha pb-3">
          <div>
            <h2 className="font-display text-lg font-bold text-tinta">
              Tarefas da frente
              {tarefasFrente.length > 0 && (
                <Contagem
                  total={tarefasFrente.length}
                  concluidas={concluidasFrente}
                />
              )}
            </h2>
            <p className="text-xs text-tinta/70">
              Trabalho conjunto — pertence à frente inteira.
            </p>
          </div>
          {tarefasFrente.length > 0 && (
            <span className="rounded-full border border-linha bg-casca px-2.5 py-0.5 font-mono text-xs font-semibold text-tinta">
              {taxaFrente}%
            </span>
          )}
        </div>

        {tarefasFrente.length > 0 && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-linha">
            <div
              className="h-full w-full origin-left rounded-full bg-musgo transition-transform duration-micro ease-entrada"
              style={{ transform: `scaleX(${taxaFrente / 100})` }}
            />
          </div>
        )}

        {tarefasFrente.length === 0 ? (
          <p className="mt-4 text-sm text-tinta/70">
            Nenhuma tarefa de frente ainda.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-linha bg-campo/40">
            {daFrenteOrdenadas.map((t) => (
              <LinhaTarefa
                key={t.id}
                tarefa={t}
                aoAtualizar={carregar}
                mostrarStatus
                mostrarFrente={false}
              />
            ))}
          </div>
        )}
      </section>

      {/* Trabalho individual dos integrantes */}
      <section className="cartao p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha pb-3">
          <div>
            <h2 className="font-display text-lg font-bold text-tinta">
              Trabalho individual dos integrantes
              {tarefasIndividuais.length > 0 && (
                <Contagem
                  total={tarefasIndividuais.length}
                  concluidas={concluidasIndividuais}
                />
              )}
            </h2>
            <p className="text-xs text-tinta/70">
              Conta pro relatório final e pra validação dos professores.
            </p>
          </div>
          {tarefasIndividuais.length > 0 && (
            <span className="rounded-full border border-linha bg-casca px-2.5 py-0.5 font-mono text-xs font-semibold text-tinta">
              {taxaIndividuais}%
            </span>
          )}
        </div>

        {tarefasIndividuais.length > 0 && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-linha">
            <div
              className="h-full w-full origin-left rounded-full bg-musgo transition-transform duration-micro ease-entrada"
              style={{ transform: `scaleX(${taxaIndividuais / 100})` }}
            />
          </div>
        )}

        {tarefasIndividuais.length === 0 ? (
          <p className="mt-4 text-sm text-tinta/70">
            Ninguém tem tarefa individual ainda.
          </p>
        ) : (
          <div className="mt-4 space-y-6">
            {emAndamentoPorPessoa.length === 0 ? (
              <p className="text-sm text-tinta/70">
                Nada em andamento — o trabalho individual da frente está todo
                entregue.
              </p>
            ) : (
              <div className="space-y-5">
                {emAndamentoPorPessoa.map((p) => (
                  <div key={p.nome}>
                    <h3 className="mb-2 font-display text-sm font-bold text-tinta">
                      {p.nome}
                    </h3>
                    <div className="overflow-hidden rounded-xl border border-linha bg-campo/40">
                      {p.itens.map((t) => (
                        <LinhaTarefa
                          key={t.id}
                          tarefa={t}
                          aoAtualizar={carregar}
                          mostrarStatus
                          mostrarQuem={false}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {individuaisConcluidas.length > 0 && (
              <div className="border-t border-linha pt-5">
                <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-bold text-tinta">
                  <span>Concluídas</span>
                  <span className="rounded-full border border-linha bg-casca px-2 py-0.5 font-mono text-xs font-normal text-tinta/70">
                    {individuaisConcluidas.length}
                  </span>
                </h3>
                <div className="overflow-hidden rounded-xl border border-linha bg-campo/40">
                  {individuaisConcluidas.map((t) => (
                    <LinhaTarefa
                      key={t.id}
                      tarefa={t}
                      aoAtualizar={carregar}
                      mostrarStatus
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Contagem({
  total,
  concluidas,
}: {
  total: number;
  concluidas: number;
}) {
  return (
    <span className="ml-2 text-xs font-normal text-tinta/70">
      · <span className="font-mono">{total}</span>
      {concluidas > 0 && (
        <>
          {" · "}
          <span className="font-mono">{concluidas}</span>
          {concluidas === 1 ? " concluída" : " concluídas"}
        </>
      )}
    </span>
  );
}
