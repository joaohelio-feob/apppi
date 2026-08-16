"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import {
  PRIORIDADES, STATUS, UNIDADES, responsaveisDe,
  type Frente, type Membro, type Status, type Tarefa,
} from "@/lib/types";
import CartaoTarefa from "@/components/CartaoTarefa";
import { useNovaTarefa } from "@/components/NovaTarefaProvider";
import { useToast } from "@/components/ToastProvider";

const CHAVE_MINHAS = "pi-quadro-somente-minhas";
const CHAVE_VISAO = "pi-quadro-visao";

type Visao = "frente" | "individual";

export default function Quadro() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [visao, setVisao] = useState<Visao>("individual");
  const [busca, setBusca] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [somenteMinhas, setSomenteMinhas] = useState(false);

  const { abrir } = useNovaTarefa();
  const { avisar } = useToast();
  const supabase = criarClienteNavegador();

  useEffect(() => {
    setSomenteMinhas(localStorage.getItem(CHAVE_MINHAS) === "1");
    const visaoSalva = localStorage.getItem(CHAVE_VISAO);
    if (visaoSalva === "frente" || visaoSalva === "individual") setVisao(visaoSalva);
  }, []);

  function alternarMinhas() {
    setSomenteMinhas((atual) => {
      const novo = !atual;
      localStorage.setItem(CHAVE_MINHAS, novo ? "1" : "0");
      return novo;
    });
  }

  function mudarVisao(nova: Visao) {
    setVisao(nova);
    localStorage.setItem(CHAVE_VISAO, nova);
  }

  const carregar = useCallback(async () => {
    const [t, m, f, sessao] = await Promise.all([
      supabase
        .from("tarefas")
        .select("*, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, cor)")
        .eq("arquivada", false)
        .order("prazo", { ascending: true, nullsFirst: false }),
      supabase.from("membros").select("id, nome, papel, frente_id").order("nome"),
      supabase.from("frentes").select("id, nome").order("nome"),
      supabase.auth.getUser(),
    ]);
    setTarefas((t.data ?? []) as Tarefa[]);
    setMembros((m.data ?? []) as Membro[]);
    setFrentes((f.data ?? []) as Frente[]);
    setMeuId(sessao.data.user?.id ?? null);
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
    const anterior = tarefas.find((t) => t.id === id)?.status;
    setTarefas((atual) => atual.map((t) => (t.id === id ? { ...t, status } : t)));
    const { error } = await supabase.from("tarefas").update({ status }).eq("id", id);
    if (error && anterior) {
      setTarefas((atual) => atual.map((t) => (t.id === id ? { ...t, status: anterior } : t)));
      avisar("Não deu pra mudar o status. Tenta de novo.");
    }
  }

  async function arquivar(id: number) {
    if (!confirm("Arquivar esta tarefa? Ela some do quadro, mas o histórico continua.")) return;
    setTarefas((atual) => atual.filter((t) => t.id !== id));
    await supabase.from("tarefas").update({ arquivada: true }).eq("id", id);
  }

  const visiveis = useMemo(() => {
    const buscaLimpa = busca.trim().toLowerCase();
    return tarefas.filter((t) => {
      const responsaveis = responsaveisDe(t);
      if (t.escopo !== visao) return false;
      if (buscaLimpa && !t.titulo.toLowerCase().includes(buscaLimpa)) return false;
      if (filtroResponsavel && !responsaveis.some((m) => m.id === filtroResponsavel)) return false;
      if (filtroPrioridade && t.prioridade !== filtroPrioridade) return false;
      if (filtroUnidade && t.unidade !== filtroUnidade) return false;
      if (somenteMinhas && !responsaveis.some((m) => m.id === meuId)) return false;
      return true;
    });
  }, [tarefas, visao, busca, filtroResponsavel, filtroPrioridade, filtroUnidade, somenteMinhas, meuId]);

  const grupos = useMemo(() => {
    if (visao === "frente") {
      return frentes
        .map((f) => ({ chave: String(f.id), titulo: f.nome, itens: visiveis.filter((t) => t.frente_id === f.id) }))
        .filter((g) => g.itens.length > 0);
    }
    const porPessoa = new Map<string, { chave: string; titulo: string; itens: Tarefa[] }>();
    visiveis.forEach((t) => {
      const responsavel = responsaveisDe(t)[0];
      const chave = responsavel?.id ?? "sem-dono";
      const titulo = responsavel?.nome ?? "Sem dono";
      if (!porPessoa.has(chave)) porPessoa.set(chave, { chave, titulo, itens: [] });
      porPessoa.get(chave)!.itens.push(t);
    });
    return Array.from(porPessoa.values()).sort((a, b) => a.titulo.localeCompare(b.titulo));
  }, [visao, visiveis, frentes]);

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
          onClick={abrir}
          className="bg-tinta px-4 py-2 text-sm font-semibold text-campo hover:bg-musgo"
        >
          Nova tarefa <span className="font-mono text-xs opacity-60">(n)</span>
        </button>
      </div>

      <div className="mt-6 flex gap-1 border border-linha p-1 sm:w-fit">
        <button
          onClick={() => mudarVisao("individual")}
          className={`flex-1 px-4 py-1.5 font-mono text-xs uppercase sm:flex-none ${
            visao === "individual" ? "bg-tinta text-campo" : "text-tinta/60 hover:bg-casca"
          }`}
        >
          Individuais
        </button>
        <button
          onClick={() => mudarVisao("frente")}
          className={`flex-1 px-4 py-1.5 font-mono text-xs uppercase sm:flex-none ${
            visao === "frente" ? "bg-tinta text-campo" : "text-tinta/60 hover:bg-casca"
          }`}
        >
          Da frente
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por título…"
          className="min-w-[200px] flex-1 border border-linha bg-casca px-3 py-2 text-sm"
        />
        <select
          value={filtroResponsavel}
          onChange={(e) => setFiltroResponsavel(e.target.value)}
          className="border border-linha bg-casca px-2 py-2 font-mono text-xs uppercase"
        >
          <option value="">Todo mundo</option>
          {membros.map((m) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </select>
        <select
          value={filtroPrioridade}
          onChange={(e) => setFiltroPrioridade(e.target.value)}
          className="border border-linha bg-casca px-2 py-2 font-mono text-xs uppercase"
        >
          <option value="">Toda prioridade</option>
          {PRIORIDADES.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
        <select
          value={filtroUnidade}
          onChange={(e) => setFiltroUnidade(e.target.value)}
          className="border border-linha bg-casca px-2 py-2 font-mono text-xs uppercase"
        >
          <option value="">Toda unidade</option>
          {UNIDADES.map((u) => (
            <option key={u.id} value={u.id}>{u.nome}</option>
          ))}
        </select>
        <button
          onClick={alternarMinhas}
          className={`border px-3 py-2 font-mono text-xs uppercase ${
            somenteMinhas ? "border-tinta bg-tinta text-campo" : "border-linha text-tinta/70 hover:bg-casca"
          }`}
        >
          minhas tarefas
        </button>
      </div>

      {carregando ? (
        <p className="mt-10 font-mono text-sm text-tinta/50">carregando…</p>
      ) : grupos.length === 0 ? (
        <p className="mt-10 text-sm text-tinta/50">
          {visao === "frente" ? "Nenhuma tarefa de frente por aqui." : "Nenhuma tarefa individual por aqui."}
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {grupos.map((g) => (
            <section key={g.chave}>
              <h2 className="mb-3 font-display text-lg font-semibold">
                {g.titulo}
                <span className="ml-2 font-mono text-xs font-normal text-tinta/50">{g.itens.length}</span>
              </h2>
              <MiniQuadro
                tarefas={g.itens}
                aoMudarStatus={mudarStatus}
                aoArquivar={arquivar}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniQuadro({
  tarefas,
  aoMudarStatus,
  aoArquivar,
}: {
  tarefas: Tarefa[];
  aoMudarStatus: (id: number, status: Status) => void;
  aoArquivar: (id: number) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {STATUS.map((coluna) => {
        const daColuna = tarefas.filter((t) => t.status === coluna.id);
        return (
          <div
            key={coluna.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = Number(e.dataTransfer.getData("text/plain"));
              if (id) aoMudarStatus(id, coluna.id);
            }}
          >
            <h3 className="mb-3 flex items-baseline gap-2 border-b border-linha pb-1 font-display text-sm font-semibold uppercase tracking-wide">
              {coluna.nome}
              <span className="font-mono text-xs font-normal text-tinta/50">{daColuna.length}</span>
            </h3>
            <div className="space-y-3">
              {daColuna.map((t) => (
                <CartaoTarefa key={t.id} tarefa={t} aoMudarStatus={aoMudarStatus} aoArquivar={aoArquivar} arrastavel />
              ))}
              {daColuna.length === 0 && <p className="text-xs text-tinta/40">Coluna vazia.</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
