"use client";

import AvisoErro from "@/components/ui/AvisoErro";

import { useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { responsaveisDe, type Tarefa } from "@/lib/types";
import { useDetalheTarefa } from "@/components/DetalheTarefaProvider";
import { useAtualizacaoTarefas } from "@/lib/useAtualizacaoTarefas";
import { dataCurta } from "@/lib/datas";

export default function Entregas() {
  const [erroCarga, setErroCarga] = useState(false);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
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

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Entregas
        </h1>
        <p className="text-sm text-tinta/70">para o relatório final</p>
      </div>
      <p className="mt-2 max-w-prose text-sm text-tinta/70">
        Toda tarefa, quem fez, quando terminou e se já está no Git. Clique numa
        linha para ver observações, anexos e marcar a entrega.
      </p>

      {erroCarga && (
        <AvisoErro
          mensagem="Não foi possível carregar os dados. Tente novamente."
          aoTentar={carregar}
        />
      )}
      {carregando ? (
        <p className="mt-10 text-sm text-tinta/70">carregando…</p>
      ) : erroCarga ? null : (
        <div className="mt-6 max-h-[70vh] overflow-auto border border-linha print:max-h-none print:overflow-visible">
          <table className="tabela-edicao min-w-[640px]">
            <thead>
              <tr className="border-b border-linha bg-casca font-display text-xs font-semibold text-tinta/70">
                <th className="px-3 py-2 text-left">Tarefa</th>
                <th className="px-3 py-2 text-left">Quem fez</th>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Subiu no Git</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {tarefas.map((t) => (
                <tr
                  key={t.id}
                  onClick={() =>
                    abrirDetalhe({ tarefa: t, aoAtualizar: carregar })
                  }
                  className="cursor-pointer hover:bg-casca"
                >
                  <td className="px-3 py-2 font-semibold">
                    <button
                      className="text-left hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirDetalhe({ tarefa: t, aoAtualizar: carregar });
                      }}
                    >
                      {t.titulo}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-tinta/70">
                    {responsaveisDe(t)
                      .map((m) => m.nome)
                      .join(", ") || "sem responsável"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-tinta/70">
                    {t.concluido_em
                      ? dataCurta(t.concluido_em)
                      : t.prazo
                        ? `prazo ${new Date(t.prazo + "T12:00:00").toLocaleDateString("pt-BR")}`
                        : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 font-mono text-xs uppercase tracking-wide ${
                        t.subiu_git
                          ? "bg-musgo text-campo"
                          : "bg-linha text-tinta"
                      }`}
                    >
                      {t.subiu_git ? "sim" : "não"}
                    </span>
                  </td>
                </tr>
              ))}
              {tarefas.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-sm text-tinta/70"
                  >
                    Nenhuma tarefa ainda.
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
