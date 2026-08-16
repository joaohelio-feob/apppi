"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataLocalISO } from "@/lib/datas";
import {
  CLASSES_PRIORIDADE, PRIORIDADES, STATUS, responsaveisDe,
  type EstadoEntrega, type Frente, type Membro, type Tarefa,
} from "@/lib/types";
import DetalheTarefa from "@/components/DetalheTarefa";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export default function Calendario() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [estados, setEstados] = useState<Map<number, EstadoEntrega>>(new Map());
  const [responsavel, setResponsavel] = useState("");
  const [tarefaAberta, setTarefaAberta] = useState<Tarefa | null>(null);
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const carregar = useCallback(async () => {
    const supabase = criarClienteNavegador();
    const [{ data: t }, { data: m }, { data: f }, { data: e }] = await Promise.all([
      supabase
        .from("tarefas")
        .select("id, titulo, descricao, escopo, frente_id, status, prioridade, prazo, inicio, local_entrega, subiu_git, issue_numero, observacoes, revisor_id, commit_confirmado_em, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, cor, unidade)")
        .eq("arquivada", false)
        .not("prazo", "is", null),
      supabase.from("membros").select("id, nome, papel, frente_id").order("nome"),
      supabase.from("frentes").select("id, nome").order("nome"),
      // "Falta algo" pendente é o único estado derivado que o calendário
      // precisa (pra sinalizar o bloco vermelho) — vem da mesma view do
      // Bloco A, não recalculado aqui.
      supabase.from("tarefas_estado_entrega").select("tarefa_id, ultimo_resultado, entregue_em, revisado_em"),
    ]);
    setTarefas((t ?? []) as unknown as Tarefa[]);
    setMembros((m ?? []) as Membro[]);
    setFrentes((f ?? []) as Frente[]);
    setEstados(new Map((e ?? []).map((x) => [x.tarefa_id, x as EstadoEntrega])));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const visiveis = useMemo(
    () => (responsavel ? tarefas.filter((t) => responsaveisDe(t).some((m) => m.id === responsavel)) : tarefas),
    [tarefas, responsavel]
  );

  const celulas = useMemo(() => {
    const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    const vazias = primeiro.getDay();
    return [
      ...Array.from({ length: vazias }, () => null),
      ...Array.from({ length: total }, (_, i) => i + 1),
    ];
  }, [mes]);

  const porDia = useMemo(() => {
    const mapa: Record<string, Tarefa[]> = {};
    visiveis.forEach((t) => {
      if (!t.prazo) return;
      (mapa[t.prazo] ??= []).push(t);
    });
    return mapa;
  }, [visiveis]);

  const chave = (dia: number) =>
    `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  const hojeIso = dataLocalISO();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-musgo">
            {responsavel
              ? `Calendário pessoal · ${membros.find((m) => m.id === responsavel)?.nome ?? ""}`
              : "Calendário geral"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold capitalize tracking-tight">
            {mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            className="border border-linha bg-casca px-3 py-1.5 font-mono text-xs uppercase"
          >
            <option value="">Todo mundo</option>
            {membros.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
          <button
            onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}
            className="border border-linha px-3 py-1.5 font-mono text-xs hover:bg-casca"
          >
            ← mês anterior
          </button>
          <button
            onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}
            className="border border-linha px-3 py-1.5 font-mono text-xs hover:bg-casca"
          >
            próximo mês →
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-px border border-linha bg-linha">
        {DIAS.map((d) => (
          <div key={d} className="bg-campo px-2 py-1.5 font-mono text-xs uppercase text-tinta/70">
            {d}
          </div>
        ))}

        {celulas.map((dia, i) => {
          if (dia === null) return <div key={`v${i}`} className="min-h-[92px] bg-campo/40" />;
          const iso = chave(dia);
          const doDia = porDia[iso] ?? [];
          const ehHoje = iso === hojeIso;

          return (
            <div key={iso} className={`min-h-[92px] bg-campo p-1.5 ${ehHoje ? "ring-2 ring-inset ring-tinta" : ""}`}>
              <span className={`font-mono text-xs ${ehHoje ? "font-semibold" : "text-tinta/70"}`}>
                {String(dia).padStart(2, "0")}
              </span>
              <div className="mt-1 space-y-1">
                {doDia.slice(0, 3).map((t) => {
                  const cor = STATUS.find((s) => s.id === t.status)?.cor ?? "";
                  const prio = CLASSES_PRIORIDADE[t.prioridade];
                  const nomePrio = PRIORIDADES.find((p) => p.id === t.prioridade)?.nome ?? t.prioridade;
                  const atrasada = t.status !== "concluida" && !!t.prazo && t.prazo < hojeIso;
                  const est = estados.get(t.id);
                  const faltaAlgo =
                    est?.ultimo_resultado === "falta_algo" &&
                    !!est.revisado_em &&
                    (!est.entregue_em || new Date(est.revisado_em) > new Date(est.entregue_em));
                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setTarefaAberta(t)}
                      title={`${t.titulo} · ${responsaveisDe(t).map((m) => m.nome).join(", ") || "sem responsável"} · prioridade ${nomePrio}${atrasada ? " · atrasada" : ""}${faltaAlgo ? " · revisor pediu ajuste, veja o detalhe" : ""}`}
                      className={`block w-full truncate px-1 py-0.5 text-left text-xs leading-tight hover:opacity-80 ${cor} ${prio.borda} ${
                        atrasada ? "font-semibold ring-1 ring-inset ring-trigo" : ""
                      }`}
                    >
                      {atrasada ? "! " : ""}
                      {faltaAlgo ? "falta: " : ""}
                      {prio.glifo} {t.titulo}
                    </button>
                  );
                })}
                {doDia.length > 3 && (
                  <p className="font-mono text-xs text-tinta/70">+{doDia.length - 3}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 font-mono text-xs text-tinta/70">
        {STATUS.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5">
            <i className={`inline-block h-2.5 w-2.5 ${s.cor}`} />
            {s.nome}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 font-mono text-xs text-tinta/70">
        {PRIORIDADES.map((p) => (
          <span key={p.id} className="flex items-center gap-1.5">
            {CLASSES_PRIORIDADE[p.id].glifo} prioridade {p.nome.toLowerCase()}
          </span>
        ))}
        <span className="flex items-center gap-1.5 font-semibold text-trigo">
          ! atrasada
        </span>
        <span className="flex items-center gap-1.5 font-semibold">
          falta: revisor pediu ajuste — clique pra ver o quê
        </span>
      </div>

      {tarefaAberta && (
        <DetalheTarefa
          tarefa={tarefaAberta}
          aoFechar={() => setTarefaAberta(null)}
          aoAtualizar={carregar}
          membrosIniciais={membros}
          frentesIniciais={frentes}
        />
      )}
    </div>
  );
}
