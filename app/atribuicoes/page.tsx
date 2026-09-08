"use client";

import { useCallback, useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { PRIORIDADES, STATUS, responsaveisDe, type Frente, type Membro, type Tarefa } from "@/lib/types";
import FormularioTarefa from "@/components/FormularioTarefa";
import ConfirmarAcao from "@/components/ConfirmarAcao";
import SeloIssue from "@/components/SeloIssue";

type TarefaComAnexos = Tarefa & { anexos?: { count: number }[] };

export default function Atribuicoes() {
  const [tarefas, setTarefas] = useState<TarefaComAnexos[]>([]);
  const [arquivando, setArquivando] = useState<Tarefa | null>(null);
  const [executandoArquivo, setExecutandoArquivo] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [criandoTarefa, setCriandoTarefa] = useState(false);

  const supabase = criarClienteNavegador();

  const carregar = useCallback(async () => {
    const [{ data: t }, { data: m }, { data: f }] = await Promise.all([
      supabase
        .from("tarefas")
        .select("id, titulo, descricao, escopo, frente_id, status, prioridade, prazo, local_entrega, issue_numero, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome), anexos(count)")
        .eq("arquivada", false)
        .order("prazo", { ascending: true, nullsFirst: false }),
      supabase.from("membros").select("id, nome, papel, frente_id").order("nome"),
      supabase.from("frentes").select("id, nome").order("nome"),
    ]);
    setTarefas((t ?? []) as unknown as TarefaComAnexos[]);
    setMembros((m ?? []) as Membro[]);
    setFrentes((f ?? []) as Frente[]);
    setCarregando(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar(); }, [carregar]);

  // Atualização ao vivo: se um colega mexer numa tarefa (aqui, no Quadro ou
  // no painel de detalhe), esta tabela acompanha sem precisar recarregar.
  useEffect(() => {
    const canal = supabase
      .channel("atribuicoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [carregar]); // eslint-disable-line react-hooks/exhaustive-deps

  function atualizarLocal(id: number, campos: Partial<Tarefa>) {
    setTarefas((atual) => atual.map((t) => (t.id === id ? { ...t, ...campos } : t)));
  }

  async function salvarCampo(id: number, campo: string, valor: string | number | null) {
    await supabase.from("tarefas").update({ [campo]: valor }).eq("id", id);
  }

  async function salvarResponsavel(tarefaId: number, membroId: string) {
    const tarefa = tarefas.find((t) => t.id === tarefaId);
    const atual = tarefa ? responsaveisDe(tarefa)[0] : undefined;
    const membro = membroId ? membros.find((m) => m.id === membroId) ?? null : null;

    atualizarLocal(tarefaId, { responsaveis: membro ? [{ membro }] : [] });

    if (!membroId) {
      if (atual) await supabase.from("tarefa_responsaveis").delete().eq("tarefa_id", tarefaId).eq("membro_id", atual.id);
    } else if (atual) {
      await supabase.from("tarefa_responsaveis").update({ membro_id: membroId }).eq("tarefa_id", tarefaId).eq("membro_id", atual.id);
    } else {
      await supabase.from("tarefa_responsaveis").insert({ tarefa_id: tarefaId, membro_id: membroId });
    }
  }

  async function arquivar(t: Tarefa) {
    setExecutandoArquivo(true);
    const { error } = await supabase.from("tarefas").update({ arquivada: true }).eq("id", t.id);
    setExecutandoArquivo(false);
    setArquivando(null);
    if (error) return;
    setTarefas((atual) => atual.filter((x) => x.id !== t.id));
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

      <div className="mt-6">
        <button
          onClick={() => setCriandoTarefa(true)}
          className="bg-tinta px-4 py-2 text-sm font-semibold text-campo hover:bg-musgo"
        >
          Nova atribuição
        </button>
      </div>

      {criandoTarefa && (
        <FormularioTarefa
          membros={membros}
          frentes={frentes}
          autoFoco
          aoFechar={() => setCriandoTarefa(false)}
          aoSalvar={carregar}
        />
      )}

      {carregando ? (
        <p className="mt-10 font-mono text-sm text-tinta/70">carregando…</p>
      ) : (
        <div className="mt-6 overflow-x-auto border border-linha">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-linha bg-casca font-mono text-xs uppercase tracking-wide text-tinta/70">
                <th className="px-3 py-2 text-left">Tarefa</th>
                <th className="px-3 py-2 text-left">Responsável</th>
                <th className="px-3 py-2 text-left">Dia</th>
                <th className="px-3 py-2 text-left">Local de entrega</th>
                <th className="px-3 py-2 text-left">GitHub</th>
                <th className="px-3 py-2 text-left">Frente</th>
                <th className="px-3 py-2 text-left">Prioridade</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="sticky right-0 bg-casca px-3 py-2" />
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
                    {(t.descricao || (t.anexos?.[0]?.count ?? 0) > 0) && (
                      <div className="mt-0.5 flex items-center gap-2 px-1 text-xs text-tinta/70">
                        {t.descricao && <span className="line-clamp-1">{t.descricao}</span>}
                        {(t.anexos?.[0]?.count ?? 0) > 0 && (
                          <span className="shrink-0 font-mono">
                            {t.anexos![0].count} anexo{t.anexos![0].count > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {t.escopo === "frente" ? (
                      <span className="text-xs text-tinta/70">
                        {responsaveisDe(t).map((m) => m.nome).join(", ") || "sem responsável"}
                      </span>
                    ) : (
                      <select
                        value={responsaveisDe(t)[0]?.id ?? ""}
                        onChange={(e) => salvarResponsavel(t.id, e.target.value)}
                        className="border border-linha bg-campo px-2 py-1 font-corpo text-sm"
                      >
                        <option value="">sem dono</option>
                        {membros.map((m) => (
                          <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                      </select>
                    )}
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
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        defaultValue={t.issue_numero ?? ""}
                        placeholder="nº"
                        onBlur={(e) => {
                          const valor = e.target.value ? Number(e.target.value) : null;
                          if (valor !== t.issue_numero) {
                            atualizarLocal(t.id, { issue_numero: valor });
                            salvarCampo(t.id, "issue_numero", valor);
                          }
                        }}
                        className="w-14 border border-transparent bg-transparent px-1 py-1 font-mono hover:border-linha focus:border-linha focus:outline-none"
                      />
                      {t.issue_numero && <SeloIssue numero={t.issue_numero} />}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {t.escopo === "frente" ? (
                      <span className="font-mono text-xs uppercase text-tinta/70">
                        {t.frentes?.nome ?? "—"}
                      </span>
                    ) : (
                      <select
                        value={t.frente_id ?? ""}
                        onChange={(e) => {
                          const valor = e.target.value ? Number(e.target.value) : null;
                          const frente = frentes.find((f) => f.id === valor) ?? null;
                          atualizarLocal(t.id, { frente_id: valor, frentes: frente });
                          salvarCampo(t.id, "frente_id", valor);
                        }}
                        className="border border-linha bg-campo px-2 py-1 font-mono text-xs uppercase"
                      >
                        <option value="">sem frente</option>
                        {frentes.map((f) => (
                          <option key={f.id} value={f.id}>{f.nome}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={t.prioridade}
                      onChange={(e) => {
                        const valor = e.target.value as Tarefa["prioridade"];
                        atualizarLocal(t.id, { prioridade: valor });
                        salvarCampo(t.id, "prioridade", valor);
                      }}
                      className="border border-linha bg-campo px-2 py-1 font-mono text-xs uppercase"
                    >
                      {PRIORIDADES.map((p) => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={t.status}
                      onChange={(e) => {
                        const valor = e.target.value as Tarefa["status"];
                        atualizarLocal(t.id, { status: valor });
                        salvarCampo(t.id, "status", valor);
                      }}
                      className="border border-linha bg-campo px-2 py-1 font-mono text-xs uppercase"
                    >
                      {STATUS.map((s) => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  </td>
                  <td className="sticky right-0 bg-campo px-3 py-2 text-right">
                    <button
                      onClick={() => setArquivando(t)}
                      className="px-1 py-0.5 font-mono text-xs text-tinta/70 transition-colors duration-micro ease-entrada hover:bg-trigo hover:text-tinta"
                    >
                      arquivar
                    </button>
                  </td>
                </tr>
              ))}
              {tarefas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-sm text-tinta/70">
                    Nenhuma atribuição ainda. Crie a primeira acima.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {arquivando && (
        <ConfirmarAcao
          titulo="Arquivar esta tarefa?"
          descricao={
            <>
              <strong className="font-semibold text-tinta">{arquivando.titulo}</strong> sai desta
              tabela, do quadro, do calendário e da Semana, e passa a aparecer no filtro
              “arquivadas” do quadro. Nada é apagado: o histórico continua na Trilha, e dá para
              restaurar.
            </>
          }
          rotuloConfirmar="Arquivar"
          executando={executandoArquivo}
          aoConfirmar={() => arquivar(arquivando)}
          aoCancelar={() => setArquivando(null)}
        />
      )}
    </div>
  );
}
