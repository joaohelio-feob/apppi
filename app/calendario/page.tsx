"use client";

import { useEffect, useMemo, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataLocalISO } from "@/lib/datas";
import { STATUS, type Membro, type Tarefa } from "@/lib/types";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export default function Calendario() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [responsavel, setResponsavel] = useState("");
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    const supabase = criarClienteNavegador();
    supabase
      .from("tarefas")
      .select("*, membros:responsavel_id(id, nome, papel)")
      .eq("arquivada", false)
      .not("prazo", "is", null)
      .then(({ data }) => setTarefas((data ?? []) as Tarefa[]));
    supabase.from("membros").select("id, nome, papel").order("nome")
      .then(({ data }) => setMembros((data ?? []) as Membro[]));
  }, []);

  const visiveis = useMemo(
    () => (responsavel ? tarefas.filter((t) => t.responsavel_id === responsavel) : tarefas),
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
          <div key={d} className="bg-campo px-2 py-1.5 font-mono text-[11px] uppercase text-tinta/50">
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
              <span className={`font-mono text-[11px] ${ehHoje ? "font-semibold" : "text-tinta/50"}`}>
                {String(dia).padStart(2, "0")}
              </span>
              <div className="mt-1 space-y-1">
                {doDia.slice(0, 3).map((t) => {
                  const cor = STATUS.find((s) => s.id === t.status)?.cor ?? "";
                  return (
                    <div
                      key={t.id}
                      title={`${t.titulo} · ${t.membros?.nome ?? "sem responsável"}`}
                      className={`truncate px-1 py-0.5 text-[10px] leading-tight ${cor}`}
                    >
                      {t.titulo}
                    </div>
                  );
                })}
                {doDia.length > 3 && (
                  <p className="font-mono text-[10px] text-tinta/50">+{doDia.length - 3}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 font-mono text-[11px] text-tinta/60">
        {STATUS.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5">
            <i className={`inline-block h-2.5 w-2.5 ${s.cor}`} />
            {s.nome}
          </span>
        ))}
      </div>
    </div>
  );
}
