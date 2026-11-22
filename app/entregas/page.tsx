"use client";

import AvisoErro from "@/components/ui/AvisoErro";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import GuiaDidatico from "@/components/ui/GuiaDidatico";
import { useEffect, useMemo, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { iniciaisDe, responsaveisDe, type Tarefa } from "@/lib/types";
import { useDetalheTarefa } from "@/components/DetalheTarefaProvider";
import { useAtualizacaoTarefas } from "@/lib/useAtualizacaoTarefas";
import { dataCurta } from "@/lib/datas";
import {
  IconeBusca,
  IconeCheck,
  IconeEntregas,
  IconeGit,
} from "@/components/ui/Icones";

type FiltroEntrega = "todas" | "concluidas" | "no_git" | "falta_git";

export default function Entregas() {
  const [erroCarga, setErroCarga] = useState(false);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<FiltroEntrega>("todas");
  const [busca, setBusca] = useState("");
  const abrirDetalhe = useDetalheTarefa();

  const supabase = criarClienteNavegador();

  async function carregar() {
    const { data, error } = await supabase
      .from("tarefas")
      .select(
        "id, titulo, concluido_em, prazo, subiu_git, observacoes, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel))",
      )
      .eq("arquivada", false)
      .order("concluido_em", { ascending: false, nullsFirst: false });
    setErroCarga(!!error);
    if (error) {
      setCarregando(false);
      return;
    }
    setTarefas((data ?? []) as unknown as Tarefa[]);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useAtualizacaoTarefas("entregas", carregar);

  const resumo = useMemo(() => {
    const total = tarefas.length;
    const concluidas = tarefas.filter((t) => !!t.concluido_em).length;
    const noGit = tarefas.filter((t) => t.subiu_git).length;
    const percGit = total > 0 ? Math.round((noGit / total) * 100) : 0;
    return { total, concluidas, noGit, percGit };
  }, [tarefas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return tarefas.filter((t) => {
      if (filtro === "concluidas" && !t.concluido_em) return false;
      if (filtro === "no_git" && !t.subiu_git) return false;
      if (filtro === "falta_git" && t.subiu_git) return false;
      if (!q) return true;
      const nomes = responsaveisDe(t)
        .map((m) => m.nome.toLowerCase())
        .join(" ");
      return t.titulo.toLowerCase().includes(q) || nomes.includes(q);
    });
  }, [tarefas, filtro, busca]);

  return (
    <div>
      <CabecalhoPagina
        categoria="Para o relatório final"
        icone={<IconeEntregas className="h-3.5 w-3.5 text-musgo" />}
        titulo="Entregas"
        contagem={!carregando ? `${tarefas.length} tarefas` : undefined}
        descricao="Panorama consolidado de quem fez cada tarefa, quando terminou e se já subiu no Git."
      />

      <GuiaDidatico
        titulo="Para que serve esta tela no PI?"
        resumo="Resumo rápido para conferir evidências antes da apresentação final."
        className="mb-6"
      >
        <p className="leading-relaxed text-tinta/70">
          Use esta lista para checar se todas as entregas possuem arquivo
          anexado, observações e confirmação no Git.{" "}
          <strong className="text-tinta">Clique em qualquer linha</strong> para
          abrir os anexos, a última entrega e a nota do revisor.
        </p>
      </GuiaDidatico>

      {!carregando && !erroCarga && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="cartao border-l-4 border-l-tinta p-4">
            <p className="text-xs font-semibold text-tinta/70">
              Total de tarefas ativas
            </p>
            <p className="mt-1 font-display text-3xl font-extrabold text-tinta">
              {resumo.total}
            </p>
          </div>

          <div className="cartao border-l-4 border-l-musgo p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-tinta/70">
              <IconeCheck className="h-3.5 w-3.5 text-musgo" />
              Concluídas
            </p>
            <p className="mt-1 font-display text-3xl font-extrabold text-tinta">
              {resumo.concluidas}
            </p>
          </div>

          <div className="cartao border-l-4 border-l-broto p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-tinta/70">
                <IconeGit className="h-3.5 w-3.5 text-musgo" />
                Subidas no Git
              </p>
              <span className="font-mono text-xs font-semibold text-musgo">
                {resumo.percGit}%
              </span>
            </div>
            <p className="mt-1 font-display text-3xl font-extrabold text-tinta">
              {resumo.noGit}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-linha">
              <div
                className="h-full w-full origin-left rounded-full bg-musgo transition-transform duration-micro ease-entrada"
                style={{ transform: `scaleX(${resumo.percGit / 100})` }}
              />
            </div>
          </div>
        </div>
      )}

      {!carregando && !erroCarga && (
        <div className="cartao mb-4 flex flex-wrap items-center justify-between gap-3 p-3.5">
          <div className="flex flex-wrap gap-1 rounded-lg border border-linha bg-casca p-1">
            {[
              { id: "todas", rotulo: "Todas" },
              { id: "concluidas", rotulo: "Concluídas" },
              { id: "no_git", rotulo: "No Git" },
              { id: "falta_git", rotulo: "Falta Git" },
            ].map((op) => (
              <button
                key={op.id}
                type="button"
                aria-pressed={filtro === op.id}
                onClick={() => setFiltro(op.id as FiltroEntrega)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-micro ease-entrada ${
                  filtro === op.id
                    ? "bg-papel text-tinta shadow-cartao"
                    : "text-tinta/70 hover:text-tinta"
                }`}
              >
                {op.rotulo}
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta/70" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar tarefa ou responsável…"
              aria-label="Filtrar entregas por título ou responsável"
              className="campo pl-9"
            />
          </div>
        </div>
      )}

      {erroCarga && (
        <AvisoErro
          mensagem="Não foi possível carregar os dados. Tente novamente."
          aoTentar={carregar}
        />
      )}
      {carregando ? (
        <p className="mt-10 text-sm text-tinta/70">Carregando entregas…</p>
      ) : erroCarga ? null : (
        <div className="cartao max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible">
          <table className="tabela-edicao min-w-[640px]">
            <thead>
              <tr className="border-b border-linha bg-casca font-display text-xs font-semibold text-tinta/70">
                <th className="px-4 py-3 text-left">Tarefa</th>
                <th className="px-4 py-3 text-left">Quem fez</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Subiu no Git</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha/80">
              {filtradas.map((t) => {
                const pessoas = responsaveisDe(t);
                return (
                  <tr
                    key={t.id}
                    onClick={() =>
                      abrirDetalhe({ tarefa: t, aoAtualizar: carregar })
                    }
                    className="cursor-pointer hover:bg-casca/60"
                  >
                    <td className="px-4 py-3 font-semibold text-tinta">
                      <button
                        type="button"
                        className="text-left hover:text-musgo hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirDetalhe({ tarefa: t, aoAtualizar: carregar });
                        }}
                      >
                        {t.titulo}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {pessoas.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-musgo font-mono text-xs font-semibold text-campo">
                            {iniciaisDe(pessoas[0].nome)}
                          </span>
                          <span className="text-sm text-tinta/70">
                            {pessoas.map((m) => m.nome).join(", ")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-tinta/70">
                          sem responsável
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-tinta/70">
                      {t.concluido_em
                        ? dataCurta(t.concluido_em)
                        : t.prazo
                          ? `prazo ${new Date(t.prazo + "T12:00:00").toLocaleDateString("pt-BR")}`
                          : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide ${
                          t.subiu_git
                            ? "bg-musgo text-campo"
                            : "bg-casca text-tinta"
                        }`}
                      >
                        {t.subiu_git ? "Sim" : "Não"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtradas.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-tinta/70"
                  >
                    {tarefas.length === 0
                      ? "Nenhuma tarefa ainda."
                      : "Nenhuma tarefa corresponde ao filtro atual."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
