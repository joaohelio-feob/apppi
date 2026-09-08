"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { UNIDADES_FRENTE, CORES_FRENTE, responsaveisDe, type CorFrente, type Frente, type Membro, type Tarefa, type Unidade } from "@/lib/types";
import LinhaTarefa from "@/components/LinhaTarefa";

/**
 * Concluída por último, preservando a ordem por prazo entre as não concluídas
 * — Array.prototype.sort é estável desde a ES2019, então o `.order("prazo")`
 * da consulta continua valendo dentro de cada grupo.
 *
 * É ordenação, não filtro: nada some e nada depende de toggle. Concluída é a
 * evidência que o PI avalia, e não é o mesmo caso de arquivada, que é
 * descarte. Mas o que está em andamento fica em cima, onde a leitura começa.
 */
const concluidaPorUltimo = (lista: Tarefa[]) =>
  [...lista].sort(
    (a, b) => Number(a.status === "concluida") - Number(b.status === "concluida")
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
      // Membros vêm embutidos (FK reversa) em vez de uma consulta à parte.
      supabase
        .from("frentes")
        .select("id, nome, unidade, cor, ordem, criado_em, membros(id, nome, papel, frente_id)")
        .eq("id", frenteId)
        .order("nome", { foreignTable: "membros" })
        .single(),
      supabase
        .from("tarefas")
        .select(`${CAMPOS_TAREFA}, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, cor, unidade)`)
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
        .select(`${CAMPOS_TAREFA}, responsaveis:tarefa_responsaveis!inner(membro:membros(id, nome, papel)), frentes(id, nome, cor, unidade)`)
        .eq("escopo", "individual")
        .eq("arquivada", false)
        .in("tarefa_responsaveis.membro_id", integrantesDaFrente.map((m) => m.id))
        .order("prazo", { ascending: true, nullsFirst: false });
      setTarefasIndividuais((ti ?? []) as unknown as Tarefa[]);
    } else {
      setTarefasIndividuais([]);
    }

    setCarregando(false);
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  /**
   * A seção individual agrupa por pessoa só o que está EM ANDAMENTO, e junta
   * as concluídas de todo mundo num bloco único no fim.
   *
   * O motivo é de leitura, não de descarte: ordenar concluída por último
   * protege dentro de um grupo, mas não entre grupos — as concluídas de uma
   * pessoa empurravam o trabalho em andamento da pessoa seguinte para fora da
   * primeira tela (medido: y=1121 com 8+6 concluídas antes).
   *
   * Nada some. No bloco, cada linha mostra quem fez, porque a avaliação do PI
   * é por pessoa: sem o nome, juntar todo mundo transformaria a evidência de
   * trabalho entregue numa pilha anônima. Por isso ele também vai ordenado
   * por nome — sort estável, então a ordem por prazo se mantém dentro de cada
   * pessoa.
   *
   * Quem não tem nada em andamento não vira grupo vazio aqui em cima:
   * aparece só no bloco, identificado pelo nome na linha.
   */
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
      if (!mapa.has(pessoa.id)) mapa.set(pessoa.id, { nome: pessoa.nome, itens: [] });
      mapa.get(pessoa.id)!.itens.push(t);
    });

    return {
      emAndamentoPorPessoa: Array.from(mapa.values()).sort((a, b) =>
        a.nome.localeCompare(b.nome)
      ),
      individuaisConcluidas: [...concluidas]
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((c) => c.tarefa),
    };
  }, [tarefasIndividuais]);

  async function salvarEdicao(campos: Partial<Pick<Frente, "nome" | "unidade" | "cor" | "ordem">>) {
    if (!frente) return;
    setSalvando(true);
    const atualizado = { ...frente, ...campos };
    setFrente(atualizado);
    await criarClienteNavegador().from("frentes").update(campos).eq("id", frente.id);
    setSalvando(false);
  }

  const nomeUnidade = UNIDADES_FRENTE.find((u) => u.id === frente?.unidade)?.nome ?? null;

  const daFrenteOrdenadas = concluidaPorUltimo(tarefasFrente);
  const concluidasFrente = tarefasFrente.filter((t) => t.status === "concluida").length;
  const concluidasIndividuais = tarefasIndividuais.filter((t) => t.status === "concluida").length;

  if (carregando) return <p className="mt-10 text-sm text-tinta/70">carregando…</p>;

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
        {/* Título e unidade numa faixa só, como na home. A sobrancelha em
            mono maiúsculo gastava uma faixa inteira para dizer "Frente", que
            o "← Frentes" logo acima já diz. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{frente.nome}</h1>
          {nomeUnidade && <p className="text-sm text-tinta/70">{nomeUnidade}</p>}
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
          <label className="text-xs text-tinta/70">
            Nome
            <input
              defaultValue={frente.nome}
              onBlur={(e) => e.target.value.trim() && e.target.value !== frente.nome && salvarEdicao({ nome: e.target.value })}
              className="mt-1 block min-w-[160px] border border-linha bg-campo px-3 py-2 font-corpo text-sm text-tinta"
            />
          </label>
          <label className="text-xs text-tinta/70">
            Unidade
            <select
              value={frente.unidade ?? ""}
              disabled={salvando}
              onChange={(e) => salvarEdicao({ unidade: (e.target.value || null) as Unidade | null })}
              className="mt-1 block border border-linha bg-campo px-2 py-2 text-xs disabled:opacity-50"
            >
              <option value="">Sem unidade</option>
              {UNIDADES_FRENTE.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-tinta/70">
            Cor
            <select
              value={frente.cor}
              disabled={salvando}
              onChange={(e) => salvarEdicao({ cor: e.target.value as CorFrente })}
              className="mt-1 block border border-linha bg-campo px-2 py-2 text-xs disabled:opacity-50"
            >
              {CORES_FRENTE.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-tinta/70">
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
          {tarefasFrente.length > 0 && (
            <Contagem total={tarefasFrente.length} concluidas={concluidasFrente} />
          )}
        </h2>
        <p className="mb-3 text-xs text-tinta/70">Trabalho conjunto — pertence à frente inteira.</p>
        {tarefasFrente.length === 0 ? (
          <p className="text-sm text-tinta/70">Nenhuma tarefa de frente ainda.</p>
        ) : (
          <div className="border-t border-linha">
            {daFrenteOrdenadas.map((t) => (
              <LinhaTarefa
                key={t.id}
                tarefa={t}
                aoAtualizar={carregar}
                mostrarStatus
                // A frente é a tela inteira — repetir o chip em toda linha é
                // tinta gasta. `quem` fica: atribuir_responsaveis_frente não
                // é retroativo, então quem entrou depois não está nas tarefas
                // antigas, e essa diferença é informação.
                mostrarFrente={false}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 border-b border-linha pb-1 font-display text-lg font-semibold">
          Trabalho individual dos integrantes
          {tarefasIndividuais.length > 0 && (
            <Contagem total={tarefasIndividuais.length} concluidas={concluidasIndividuais} />
          )}
        </h2>
        <p className="mb-3 text-xs text-tinta/70">
          Não fica escondido: conta pro relatório final e pra validação dos professores.
        </p>
        {tarefasIndividuais.length === 0 ? (
          <p className="text-sm text-tinta/70">Ninguém tem tarefa individual ainda.</p>
        ) : (
          <>
            {emAndamentoPorPessoa.length === 0 ? (
              <p className="text-sm text-tinta/70">
                Nada em andamento — o trabalho individual da frente está todo entregue.
              </p>
            ) : (
              <div className="space-y-8">
                {emAndamentoPorPessoa.map((p) => (
                  <div key={p.nome}>
                    {/* Nome de pessoa não é identificador técnico: sai do mono
                        maiúsculo. */}
                    <h3 className="mb-1 font-display text-sm font-semibold">{p.nome}</h3>
                    <div className="border-t border-linha">
                      {p.itens.map((t) => (
                        <LinhaTarefa
                          key={t.id}
                          tarefa={t}
                          aoAtualizar={carregar}
                          mostrarStatus
                          // O h3 acima já é a pessoa, e individual tem no
                          // máximo 1 responsável por constraint. A frente
                          // fica: esta consulta filtra por membro, então a
                          // individual pode apontar para outra frente.
                          mostrarQuem={false}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {individuaisConcluidas.length > 0 && (
              <div className="mt-10 border-t border-linha pt-5">
                <h3 className="mb-1 font-display text-sm font-semibold">
                  Concluídas
                  <span className="ml-2 text-xs font-normal text-tinta/70">
                    · <span className="font-mono">{individuaisConcluidas.length}</span>
                  </span>
                </h3>
                <div className="border-t border-linha">
                  {individuaisConcluidas.map((t) => (
                    // `mostrarQuem` fica no default (true): aqui o nome é a
                    // única coisa que recupera de quem é cada entrega.
                    <LinhaTarefa key={t.id} tarefa={t} aoAtualizar={carregar} mostrarStatus />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/**
 * Contagem inline no texto, como na home — não badge. O volume de concluídas
 * aparece junto do título para quem abre a página ver sem rolar.
 *
 * O número vai em mono (é contador); a palavra "concluídas" não vai, porque
 * mono aqui é para dado, não para texto.
 */
function Contagem({ total, concluidas }: { total: number; concluidas: number }) {
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
