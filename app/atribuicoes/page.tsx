"use client";

import { useAtualizacaoTarefas } from "@/lib/useAtualizacaoTarefas";
import CampoTabela from "@/components/ui/CampoTabela";
import AvisoErro from "@/components/ui/AvisoErro";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Botao from "@/components/ui/Botao";
import { useCallback, useEffect, useMemo, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import {
  PRIORIDADES,
  STATUS,
  responsaveisDe,
  type Frente,
  type Membro,
  type Tarefa,
} from "@/lib/types";
import { useToast } from "@/components/ToastProvider";
import FormularioTarefa from "@/components/FormularioTarefa";
import ConfirmarAcao from "@/components/ConfirmarAcao";
import SeloIssue from "@/components/SeloIssue";
import {
  IconeAtribuicoes,
  IconeBusca,
  IconeMais,
} from "@/components/ui/Icones";

type TarefaComAnexos = Tarefa & { anexos?: { count: number }[] };

export default function Atribuicoes() {
  const { avisar } = useToast();
  const [erroCarga, setErroCarga] = useState(false);
  const [pendentes, setPendentes] = useState<Set<number>>(new Set());
  function marcarPendente(id: number, pendente: boolean) {
    setPendentes((atual) => {
      const proximo = new Set(atual);
      if (pendente) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }
  const [estadoSalvo, setEstadoSalvo] = useState("");
  const [tarefas, setTarefas] = useState<TarefaComAnexos[]>([]);
  const [busca, setBusca] = useState("");
  const [arquivando, setArquivando] = useState<Tarefa | null>(null);
  const [executandoArquivo, setExecutandoArquivo] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [criandoTarefa, setCriandoTarefa] = useState(false);

  const supabase = criarClienteNavegador();

  const carregar = useCallback(async () => {
    const [
      { data: t, error: erroT },
      { data: m, error: erroM },
      { data: f, error: erroF },
    ] = await Promise.all([
      supabase
        .from("tarefas")
        .select(
          "id, titulo, descricao, escopo, frente_id, status, prioridade, prazo, local_entrega, issue_numero, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome), anexos(count)",
        )
        .eq("arquivada", false)
        .order("prazo", { ascending: true, nullsFirst: false }),
      supabase
        .from("membros")
        .select("id, nome, papel, frente_id")
        .order("nome"),
      supabase.from("frentes").select("id, nome").order("nome"),
    ]);
    setErroCarga(!!(erroT || erroM || erroF));
    if (erroT || erroM || erroF) {
      setCarregando(false);
      return;
    }
    setTarefas((t ?? []) as unknown as TarefaComAnexos[]);
    setMembros((m ?? []) as Membro[]);
    setFrentes((f ?? []) as Frente[]);
    setCarregando(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    carregar();
  }, [carregar]);

  useAtualizacaoTarefas("atribuicoes", carregar);

  function atualizarLocal(id: number, campos: Partial<Tarefa>) {
    setTarefas((atual) =>
      atual.map((t) => (t.id === id ? { ...t, ...campos } : t)),
    );
  }

  async function salvarCampo(
    id: number,
    campo: string,
    valor: string | number | null,
  ) {
    marcarPendente(id, true);
    setEstadoSalvo("Salvando…");
    const { error } = await supabase
      .from("tarefas")
      .update({ [campo]: valor })
      .eq("id", id);
    setEstadoSalvo(error ? "Não foi possível salvar." : "Alteração salva.");
    if (error) {
      avisar("Não foi possível salvar. Os dados serão recarregados.");
      await carregar();
    } else atualizarLocal(id, { [campo]: valor });
    marcarPendente(id, false);
    return !error;
  }

  async function salvarResponsavel(tarefaId: number, membroId: string) {
    const tarefa = tarefas.find((t) => t.id === tarefaId);
    const atual = tarefa ? responsaveisDe(tarefa)[0] : undefined;
    const membro = membroId
      ? (membros.find((m) => m.id === membroId) ?? null)
      : null;

    marcarPendente(tarefaId, true);
    atualizarLocal(tarefaId, { responsaveis: membro ? [{ membro }] : [] });

    setEstadoSalvo("Salvando…");
    const resultado = !membroId
      ? atual
        ? await supabase
            .from("tarefa_responsaveis")
            .delete()
            .eq("tarefa_id", tarefaId)
            .eq("membro_id", atual.id)
        : { error: null }
      : atual
        ? await supabase
            .from("tarefa_responsaveis")
            .update({ membro_id: membroId })
            .eq("tarefa_id", tarefaId)
            .eq("membro_id", atual.id)
        : await supabase
            .from("tarefa_responsaveis")
            .insert({ tarefa_id: tarefaId, membro_id: membroId });
    marcarPendente(tarefaId, false);
    setEstadoSalvo(
      resultado.error
        ? "Não foi possível salvar o responsável."
        : "Responsável salvo.",
    );
    if (resultado.error) {
      atualizarLocal(tarefaId, { responsaveis: tarefa?.responsaveis });
      avisar("Não foi possível salvar o responsável.");
    }
  }

  async function arquivar(t: Tarefa) {
    setExecutandoArquivo(true);
    const { error } = await supabase
      .from("tarefas")
      .update({ arquivada: true })
      .eq("id", t.id);
    setExecutandoArquivo(false);
    setArquivando(null);
    if (error) {
      avisar("Não foi possível arquivar.");
      return;
    }
    setTarefas((atual) => atual.filter((x) => x.id !== t.id));
  }

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return tarefas;
    return tarefas.filter((t) => {
      const nomes = responsaveisDe(t)
        .map((m) => m.nome.toLowerCase())
        .join(" ");
      return (
        t.titulo.toLowerCase().includes(q) ||
        nomes.includes(q) ||
        (t.frentes?.nome.toLowerCase().includes(q) ?? false)
      );
    });
  }, [tarefas, busca]);

  return (
    <div>
      <CabecalhoPagina
        categoria="Edição rápida em tabela"
        icone={<IconeAtribuicoes className="h-3.5 w-3.5 text-musgo" />}
        titulo="Atribuições"
        contagem={!carregando ? `${tarefas.length} tarefas` : undefined}
        descricao="Edite qualquer campo diretamente na linha. Cada alteração atualiza em tempo real o Quadro, o Calendário e a Semana."
        acoes={
          <Botao
            variante="destaque"
            disabled={carregando || erroCarga}
            onClick={() => setCriandoTarefa(true)}
          >
            <IconeMais className="h-4 w-4" />
            Nova tarefa
          </Botao>
        }
      />

      {criandoTarefa && (
        <FormularioTarefa
          membros={membros}
          frentes={frentes}
          autoFoco
          aoFechar={() => setCriandoTarefa(false)}
          aoSalvar={carregar}
        />
      )}

      <div className="cartao mb-4 flex flex-wrap items-center justify-between gap-3 p-3.5">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta/70" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por tarefa, pessoa ou frente…"
            aria-label="Filtrar atribuições"
            className="campo pl-9"
          />
        </div>

        <p role="status" className="min-h-6">
          {(pendentes.size > 0 || estadoSalvo) && (
            <span className="inline-flex items-center rounded-full border border-linha bg-casca px-3 py-1 font-mono text-xs font-semibold text-tinta">
              {pendentes.size ? "Salvando…" : estadoSalvo}
            </span>
          )}
        </p>
      </div>

      {erroCarga && (
        <AvisoErro
          mensagem="Não foi possível carregar os dados. Tente novamente."
          aoTentar={carregar}
        />
      )}
      {carregando ? (
        <p className="mt-10 text-sm text-tinta/70">Carregando tabela…</p>
      ) : erroCarga ? null : (
        <div className="cartao max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible">
          <table className="tabela-edicao min-w-[960px]">
            <thead>
              <tr className="border-b border-linha bg-casca font-display text-xs font-semibold text-tinta/70">
                <th className="px-3 py-3 text-left">Tarefa</th>
                <th className="px-3 py-3 text-left">Responsável</th>
                <th className="px-3 py-3 text-left">Dia</th>
                <th className="px-3 py-3 text-left">Local de entrega</th>
                <th className="px-3 py-3 text-left">GitHub</th>
                <th className="px-3 py-3 text-left">Frente</th>
                <th className="px-3 py-3 text-left">Prioridade</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="sticky right-0 bg-casca px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-linha/80">
              {filtradas.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2">
                    <CampoTabela
                      disabled={pendentes.has(t.id)}
                      aria-label={`Título: ${t.titulo}`}
                      required
                      valor={t.titulo}
                      aoSalvar={(valor) =>
                        valor.trim()
                          ? salvarCampo(t.id, "titulo", valor.trim())
                          : Promise.resolve(false)
                      }
                      className="w-full min-w-[180px] border border-transparent bg-transparent px-1.5 py-1 font-medium hover:border-linha focus:border-musgo focus:bg-campo focus:outline-none"
                    />
                    {(t.descricao || (t.anexos?.[0]?.count ?? 0) > 0) && (
                      <div className="mt-0.5 flex items-center gap-2 px-1.5 text-xs text-tinta/70">
                        {t.descricao && (
                          <span className="line-clamp-1">{t.descricao}</span>
                        )}
                        {(t.anexos?.[0]?.count ?? 0) > 0 && (
                          <span className="shrink-0 font-mono">
                            {t.anexos![0].count} anexo
                            {t.anexos![0].count > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {t.escopo === "frente" ? (
                      <span className="text-xs text-tinta/70">
                        {responsaveisDe(t)
                          .map((m) => m.nome)
                          .join(", ") || "sem responsável"}
                      </span>
                    ) : (
                      <select
                        disabled={pendentes.has(t.id)}
                        aria-label={`Responsável: ${t.titulo}`}
                        value={responsaveisDe(t)[0]?.id ?? ""}
                        onChange={(e) =>
                          salvarResponsavel(t.id, e.target.value)
                        }
                        className="rounded-lg border border-linha bg-campo px-2 py-1.5 font-corpo text-xs"
                      >
                        <option value="">sem dono</option>
                        {membros.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <CampoTabela
                      disabled={pendentes.has(t.id)}
                      type="date"
                      aria-label={`Prazo: ${t.titulo}`}
                      valor={t.prazo}
                      aoSalvar={(valor) =>
                        salvarCampo(t.id, "prazo", valor || null)
                      }
                      className="rounded-lg border border-linha bg-campo px-2 py-1.5 font-mono text-xs"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <CampoTabela
                      disabled={pendentes.has(t.id)}
                      aria-label={`Local de entrega: ${t.titulo}`}
                      valor={t.local_entrega}
                      placeholder="link…"
                      aoSalvar={(valor) =>
                        salvarCampo(t.id, "local_entrega", valor || null)
                      }
                      className="w-full min-w-[160px] border border-transparent bg-transparent px-1.5 py-1 hover:border-linha focus:border-musgo focus:bg-campo focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CampoTabela
                        disabled={pendentes.has(t.id)}
                        type="number"
                        min={1}
                        step={1}
                        aria-label={`Issue no GitHub: ${t.titulo}`}
                        valor={t.issue_numero}
                        placeholder="nº"
                        aoSalvar={(valor) =>
                          salvarCampo(
                            t.id,
                            "issue_numero",
                            valor ? Number(valor) : null,
                          )
                        }
                        className="w-14 border border-transparent bg-transparent px-1.5 py-1 font-mono hover:border-linha focus:border-musgo focus:bg-campo focus:outline-none"
                      />
                      {t.issue_numero && <SeloIssue numero={t.issue_numero} />}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {t.escopo === "frente" ? (
                      <span className="text-xs text-tinta/70">
                        {t.frentes?.nome ?? "—"}
                      </span>
                    ) : (
                      <select
                        disabled={pendentes.has(t.id)}
                        aria-label={`Frente: ${t.titulo}`}
                        value={t.frente_id ?? ""}
                        onChange={(e) => {
                          const valor = e.target.value
                            ? Number(e.target.value)
                            : null;
                          const frente =
                            frentes.find((f) => f.id === valor) ?? null;
                          atualizarLocal(t.id, {
                            frente_id: valor,
                            frentes: frente,
                          });
                          salvarCampo(t.id, "frente_id", valor);
                        }}
                        className="rounded-lg border border-linha bg-campo px-2 py-1.5 text-xs"
                      >
                        <option value="">sem frente</option>
                        {frentes.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nome}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      disabled={pendentes.has(t.id)}
                      aria-label={`Prioridade: ${t.titulo}`}
                      value={t.prioridade}
                      onChange={(e) => {
                        const valor = e.target.value as Tarefa["prioridade"];
                        atualizarLocal(t.id, { prioridade: valor });
                        salvarCampo(t.id, "prioridade", valor);
                      }}
                      className="rounded-lg border border-linha bg-campo px-2 py-1.5 text-xs"
                    >
                      {PRIORIDADES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      disabled={pendentes.has(t.id)}
                      aria-label={`Status: ${t.titulo}`}
                      value={t.status}
                      onChange={(e) => {
                        const valor = e.target.value as Tarefa["status"];
                        atualizarLocal(t.id, { status: valor });
                        salvarCampo(t.id, "status", valor);
                      }}
                      className="rounded-lg border border-linha bg-campo px-2 py-1.5 text-xs"
                    >
                      {STATUS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="sticky right-0 bg-papel px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setArquivando(t)}
                      className="rounded-md px-2 py-1 font-mono text-xs text-tinta/70 transition-colors duration-micro ease-entrada hover:bg-trigo hover:text-tinta"
                    >
                      arquivar
                    </button>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-sm text-tinta/70"
                  >
                    {tarefas.length === 0
                      ? "Nenhuma atribuição ainda. Crie a primeira acima."
                      : "Nenhuma atribuição encontrada para essa busca."}
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
              <strong className="font-semibold text-tinta">
                {arquivando.titulo}
              </strong>{" "}
              sai desta tabela, do quadro, do calendário e da Semana, e passa a
              aparecer no filtro “arquivadas” do quadro. Nada é apagado: o
              histórico continua na Trilha, e dá para restaurar.
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
