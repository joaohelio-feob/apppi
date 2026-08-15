"use client";

import { useCallback, useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { STATUS, type Membro, type Status, type Tarefa } from "@/lib/types";
import CartaoTarefa from "@/components/CartaoTarefa";

export default function Quadro() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [abrindo, setAbrindo] = useState(false);

  const supabase = criarClienteNavegador();

  const carregar = useCallback(async () => {
    const [t, m] = await Promise.all([
      supabase
        .from("tarefas")
        .select("*, membros:responsavel_id(id, nome, papel)")
        .order("prazo", { ascending: true, nullsFirst: false }),
      supabase.from("membros").select("id, nome, papel").order("nome"),
    ]);
    setTarefas((t.data ?? []) as Tarefa[]);
    setMembros((m.data ?? []) as Membro[]);
    setCarregando(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar(); }, [carregar]);

  // Atualização ao vivo: se um colega mexer, seu quadro acompanha.
  useEffect(() => {
    const canal = supabase
      .channel("quadro")
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [carregar]); // eslint-disable-line react-hooks/exhaustive-deps

  async function mudarStatus(id: number, status: Status) {
    setTarefas((atual) => atual.map((t) => (t.id === id ? { ...t, status } : t)));
    await supabase.from("tarefas").update({ status }).eq("id", id);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-musgo">Quadro</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
            Todas as tarefas
          </h1>
        </div>
        <button
          onClick={() => setAbrindo(true)}
          className="bg-tinta px-4 py-2 text-sm font-semibold text-campo hover:bg-musgo"
        >
          Nova tarefa
        </button>
      </div>

      {carregando ? (
        <p className="mt-10 font-mono text-sm text-tinta/50">carregando…</p>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUS.map((coluna) => {
            const daColuna = tarefas.filter((t) => t.status === coluna.id);
            return (
              <div key={coluna.id}>
                <h2 className="mb-3 flex items-baseline gap-2 border-b border-linha pb-1 font-display text-sm font-semibold uppercase tracking-wide">
                  {coluna.nome}
                  <span className="font-mono text-xs font-normal text-tinta/50">
                    {daColuna.length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {daColuna.map((t) => (
                    <CartaoTarefa key={t.id} tarefa={t} aoMudarStatus={mudarStatus} />
                  ))}
                  {daColuna.length === 0 && (
                    <p className="text-xs text-tinta/40">Coluna vazia.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {abrindo && (
        <FormularioTarefa
          membros={membros}
          aoFechar={() => setAbrindo(false)}
          aoSalvar={carregar}
        />
      )}
    </div>
  );
}

function FormularioTarefa({
  membros,
  aoFechar,
  aoSalvar,
}: {
  membros: Membro[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState("");
  const [issue, setIssue] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!titulo.trim()) {
      setErro("Dê um título à tarefa para poder salvar.");
      return;
    }
    setSalvando(true);
    const supabase = criarClienteNavegador();
    const { data: sessao } = await supabase.auth.getUser();

    const { error } = await supabase.from("tarefas").insert({
      titulo,
      descricao: descricao || null,
      responsavel_id: responsavel || null,
      criador_id: sessao.user?.id ?? null,
      prazo: prazo || null,
      issue_url: issue || null,
    });

    setSalvando(false);
    if (error) { setErro(error.message); return; }
    aoSalvar();
    aoFechar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-4 sm:items-center">
      <div className="w-full max-w-md border border-linha bg-campo p-5">
        <h2 className="font-display text-xl font-bold">Nova tarefa</h2>

        <div className="mt-4 space-y-3">
          <input
            className="w-full border border-linha bg-casca px-3 py-2 text-sm"
            placeholder="O que precisa ser feito"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
          <textarea
            className="w-full border border-linha bg-casca px-3 py-2 text-sm"
            rows={3}
            placeholder="Detalhes, critérios de aceite…"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <label className="block font-mono text-[11px] uppercase text-tinta/60">
            Responsável
            <select
              className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm normal-case text-tinta"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
            >
              <option value="">Ainda sem dono</option>
              {membros.map((m) => (
                <option key={m.id} value={m.id}>{m.nome} · {m.papel}</option>
              ))}
            </select>
          </label>
          <label className="block font-mono text-[11px] uppercase text-tinta/60">
            Prazo
            <input
              type="date"
              className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm text-tinta"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
            />
          </label>
          <input
            className="w-full border border-linha bg-casca px-3 py-2 text-sm"
            placeholder="Link da issue no GitHub (opcional)"
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
          />

          {erro && <p className="font-mono text-xs text-trigo">{erro}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={salvar}
            disabled={salvando}
            className="bg-tinta px-4 py-2 text-sm font-semibold text-campo hover:bg-musgo disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Criar tarefa"}
          </button>
          <button onClick={aoFechar} className="px-4 py-2 text-sm text-tinta/60 hover:text-tinta">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
