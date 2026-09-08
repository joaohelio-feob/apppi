"use client";

import { useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { responsaveisDe, type Tarefa } from "@/lib/types";
import GerenciadorAnexos from "@/components/GerenciadorAnexos";
import NotaRevisor from "@/components/NotaRevisor";
import { dataCurta } from "@/lib/datas";

export default function Entregas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberta, setAberta] = useState<Tarefa | null>(null);

  const supabase = criarClienteNavegador();

  async function carregar() {
    const { data } = await supabase
      .from("tarefas")
      .select("id, titulo, concluido_em, prazo, subiu_git, observacoes, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel))")
      .eq("arquivada", false)
      .order("concluido_em", { ascending: false, nullsFirst: false });
    setTarefas((data ?? []) as unknown as Tarefa[]);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function atualizarNaLista(id: number, campos: Partial<Tarefa>) {
    setTarefas((atual) => atual.map((t) => (t.id === id ? { ...t, ...campos } : t)));
    setAberta((atual) => (atual && atual.id === id ? { ...atual, ...campos } : atual));
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Entregas</h1>
        <p className="text-sm text-tinta/70">para o relatório final</p>
      </div>
      <p className="mt-2 max-w-prose text-sm text-tinta/70">
        Toda tarefa, quem fez, quando terminou e se já está no Git. Clique numa linha para ver
        observações, anexos e marcar a entrega.
      </p>

      {carregando ? (
        <p className="mt-10 text-sm text-tinta/70">carregando…</p>
      ) : (
        <div className="mt-6 overflow-x-auto border border-linha">
          <table className="w-full min-w-[640px] border-collapse text-sm">
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
                  onClick={() => setAberta(t)}
                  className="cursor-pointer hover:bg-casca"
                >
                  <td className="px-3 py-2 font-semibold">{t.titulo}</td>
                  <td className="px-3 py-2 text-tinta/70">
                    {responsaveisDe(t).map((m) => m.nome).join(", ") || "sem responsável"}
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
                        t.subiu_git ? "bg-musgo text-campo" : "bg-linha text-tinta"
                      }`}
                    >
                      {t.subiu_git ? "sim" : "não"}
                    </span>
                  </td>
                </tr>
              ))}
              {tarefas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-tinta/70">
                    Nenhuma tarefa ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {aberta && (
        <PainelEntrega
          tarefa={aberta}
          aoFechar={() => setAberta(null)}
          aoAtualizar={atualizarNaLista}
        />
      )}
    </div>
  );
}

function PainelEntrega({
  tarefa,
  aoFechar,
  aoAtualizar,
}: {
  tarefa: Tarefa;
  aoFechar: () => void;
  aoAtualizar: (id: number, campos: Partial<Tarefa>) => void;
}) {
  const supabase = criarClienteNavegador();
  const [entregueEm, setEntregueEm] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("tarefas_estado_entrega")
      .select("entregue_em")
      .eq("tarefa_id", tarefa.id)
      .maybeSingle()
      .then(({ data }) => setEntregueEm((data as { entregue_em: string | null } | null)?.entregue_em ?? null));
  }, [tarefa.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvarObservacoes(valor: string) {
    aoAtualizar(tarefa.id, { observacoes: valor });
    await supabase.from("tarefas").update({ observacoes: valor || null }).eq("id", tarefa.id);
  }

  async function alternarGit(valor: boolean) {
    aoAtualizar(tarefa.id, { subiu_git: valor });
    await supabase.from("tarefas").update({ subiu_git: valor }).eq("id", tarefa.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto border border-linha bg-campo p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-tinta/70">
              {responsaveisDe(tarefa).map((m) => m.nome).join(", ") || "sem responsável"}
            </p>
            <h2 className="mt-0.5 font-display text-xl font-bold">{tarefa.titulo}</h2>
          </div>
          <button onClick={aoFechar} className="font-mono text-xs text-tinta/70 hover:text-tinta">
            fechar
          </button>
        </div>

        <NotaRevisor tarefaId={tarefa.id} entregueEm={entregueEm} />

        <label className="mt-5 flex items-center gap-2 border border-linha bg-casca px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={tarefa.subiu_git}
            onChange={(e) => alternarGit(e.target.checked)}
          />
          Já subiu no Git
        </label>

        <div className="mt-4">
          <label className="block text-xs text-tinta/70">Observações</label>
          <textarea
            defaultValue={tarefa.observacoes ?? ""}
            rows={3}
            placeholder="Notas de quem entregou…"
            onBlur={(e) => {
              if (e.target.value !== (tarefa.observacoes ?? "")) salvarObservacoes(e.target.value);
            }}
            className="mt-1 w-full border border-linha bg-casca px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-5">
          <GerenciadorAnexos tarefaId={tarefa.id} />
        </div>
      </div>
    </div>
  );
}
