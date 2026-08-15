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
        .eq("arquivada", false)
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

  async function arquivar(id: number) {
    if (!confirm("Arquivar esta tarefa? Ela some do quadro, mas o histórico continua.")) return;
    setTarefas((atual) => atual.filter((t) => t.id !== id));
    await supabase.from("tarefas").update({ arquivada: true }).eq("id", id);
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
                    <CartaoTarefa key={t.id} tarefa={t} aoMudarStatus={mudarStatus} aoArquivar={arquivar} />
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
  const [localEntrega, setLocalEntrega] = useState("");
  const [anexo, setAnexo] = useState<File | null>(null);
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

    const { data: tarefa, error } = await supabase
      .from("tarefas")
      .insert({
        titulo,
        descricao: descricao || null,
        responsavel_id: responsavel || null,
        criador_id: sessao.user?.id ?? null,
        prazo: prazo || null,
        local_entrega: localEntrega || null,
      })
      .select("id")
      .single();

    if (error || !tarefa) {
      setSalvando(false);
      setErro(error?.message ?? "Não deu pra criar a tarefa.");
      return;
    }

    if (anexo) {
      const caminho = `${tarefa.id}/${Date.now()}-${anexo.name}`;
      const { error: erroUpload } = await supabase.storage.from("entregas").upload(caminho, anexo);
      if (!erroUpload) {
        await supabase.from("anexos").insert({
          tarefa_id: tarefa.id,
          autor_id: sessao.user?.id ?? null,
          nome: anexo.name,
          caminho,
        });
      }
    }

    setSalvando(false);
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
            placeholder="Local de entrega: link do Drive, Forms, GitHub… (opcional)"
            value={localEntrega}
            onChange={(e) => setLocalEntrega(e.target.value)}
          />
          <label className="block font-mono text-[11px] uppercase text-tinta/60">
            Anexar documento (opcional)
            <input
              type="file"
              onChange={(e) => setAnexo(e.target.files?.[0] ?? null)}
              className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-xs normal-case text-tinta file:mr-2 file:border-0 file:bg-tinta file:px-2 file:py-1 file:text-xs file:text-campo"
            />
          </label>

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
