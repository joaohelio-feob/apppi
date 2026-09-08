"use client";

import { useCallback, useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataCurta, dataLocalISO } from "@/lib/datas";
import { UNIDADES_FRENTE, responsaveisDe, type Frente, type Membro, type Reuniao, type Tarefa } from "@/lib/types";
import BotaoExportarCSV from "@/components/BotaoExportarCSV";
import BotaoExportarPDF from "@/components/BotaoExportarPDF";

type Movimentacao = {
  em: string;
  autor: string | null;
  acao: string;
  tarefa: string | null;
  escopo: string | null;
  frente: string | null;
  frente_unidade: string | null;
};

function primeiroDiaDoMes() {
  const d = new Date();
  return dataLocalISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

export default function SprintReport() {
  const [inicio, setInicio] = useState(primeiroDiaDoMes());
  const [fim, setFim] = useState(dataLocalISO());
  const [carregando, setCarregando] = useState(false);
  const [gerado, setGerado] = useState(false);

  const [concluidas, setConcluidas] = useState<Tarefa[]>([]);
  const [atrasadas, setAtrasadas] = useState<Tarefa[]>([]);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [membros, setMembros] = useState<(Membro & { frentes?: Frente | null })[]>([]);

  const gerar = useCallback(async () => {
    setCarregando(true);
    const supabase = criarClienteNavegador();
    const fimFechado = `${fim}T23:59:59`;

    const [
      { data: tarefasData }, { data: reunioesData },
      { data: trilhaData }, { data: membrosData },
    ] = await Promise.all([
      // Concluídas-no-período e atrasadas-no-período são dois recortes da
      // mesma tabela — busca só uma vez com OR e separa em memória, em vez
      // de duas idas ao banco quase idênticas.
      supabase
        .from("tarefas")
        .select("id, titulo, concluido_em, prazo, escopo, status, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, unidade)")
        .or(`and(concluido_em.gte.${inicio},concluido_em.lte.${fimFechado}),and(prazo.gte.${inicio},prazo.lte.${fim})`),
      supabase.from("reunioes").select("*").gte("data", inicio).lte("data", fim).order("data"),
      supabase
        .from("relatorio_atividades")
        .select("em, autor, acao, tarefa, escopo, frente, frente_unidade")
        .gte("em", inicio)
        .lte("em", fimFechado)
        .order("em", { ascending: false })
        .limit(200),
      // Frente vem embutida (FK membros.frente_id) — dispensa uma consulta à parte.
      supabase.from("membros").select("id, nome, papel, frente_id, frentes(id, nome, unidade)"),
    ]);

    const todas = (tarefasData ?? []) as unknown as Tarefa[];
    setConcluidas(
      todas.filter((t) => t.concluido_em && t.concluido_em >= inicio && t.concluido_em <= fimFechado)
    );
    setAtrasadas(
      todas
        .filter((t) => t.prazo && t.prazo >= inicio && t.prazo <= fim)
        .filter((t) => {
          if (!t.prazo) return false;
          if (t.concluido_em) return dataLocalISO(new Date(t.concluido_em)) > t.prazo;
          return t.status !== "concluida" && t.prazo < dataLocalISO();
        })
    );

    setReunioes((reunioesData ?? []) as Reuniao[]);
    setMovimentacoes((trilhaData ?? []) as Movimentacao[]);
    setMembros((membrosData ?? []) as unknown as (Membro & { frentes?: Frente | null })[]);
    setCarregando(false);
    setGerado(true);
  }, [inicio, fim]);

  useEffect(() => { gerar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const porPessoa = concluidas.reduce<Record<string, number>>((acc, t) => {
    const responsaveis = responsaveisDe(t);
    if (responsaveis.length === 0) {
      acc["sem responsável"] = (acc["sem responsável"] ?? 0) + 1;
    } else {
      responsaveis.forEach((m) => { acc[m.nome] = (acc[m.nome] ?? 0) + 1; });
    }
    return acc;
  }, {});

  const porUnidade = concluidas.reduce<Record<string, number>>((acc, t) => {
    const nome = t.frentes?.unidade
      ? UNIDADES_FRENTE.find((u) => u.id === t.frentes!.unidade)?.nome ?? t.frentes.unidade
      : "sem frente";
    acc[nome] = (acc[nome] ?? 0) + 1;
    return acc;
  }, {});

  const periodoFormatado = `${new Date(inicio + "T12:00:00").toLocaleDateString("pt-BR")} a ${new Date(
    fim + "T12:00:00"
  ).toLocaleDateString("pt-BR")}`;

  const movimentacoesPorAutor = movimentacoes.reduce<Record<string, number>>((acc, m) => {
    const nome = m.autor ?? "desconhecido";
    acc[nome] = (acc[nome] ?? 0) + 1;
    return acc;
  }, {});

  const resumoPorPessoa = membros.map((m) => {
    const dela = concluidas.filter((t) => responsaveisDe(t).some((r) => r.id === m.id));
    const individuais = dela.filter((t) => t.escopo === "individual");
    const deFrente = dela.filter((t) => t.escopo === "frente");
    const unidades = Array.from(
      new Set(
        dela
          .map((t) => t.frentes?.unidade)
          .filter((u): u is NonNullable<typeof u> => !!u)
          .map((u) => UNIDADES_FRENTE.find((x) => x.id === u)?.nome ?? u)
      )
    );
    const frenteDela = m.frentes;
    return {
      nome: m.nome,
      frente: frenteDela?.nome ?? "sem frente",
      unidadeFrente: UNIDADES_FRENTE.find((u) => u.id === frenteDela?.unidade)?.nome ?? null,
      individuais: individuais.length,
      deFrente: deFrente.length,
      unidades,
      movimentacoes: movimentacoesPorAutor[m.nome] ?? 0,
    };
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 print:block">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-musgo">Sprint Report</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
            O que a equipe entregou no período
          </h1>
        </div>
        {gerado && (
          <div className="flex gap-2 print:hidden">
            <BotaoExportarCSV
              linhas={concluidas.map((t) => ({
                tarefa: t.titulo,
                responsavel: responsaveisDe(t).map((m) => m.nome).join(", "),
                escopo: t.escopo,
                frente: t.frentes?.nome ?? "",
                frente_unidade: t.frentes?.unidade ?? "",
                concluido_em: t.concluido_em,
                prazo: t.prazo,
              }))}
              colunas={["tarefa", "responsavel", "escopo", "frente", "frente_unidade", "concluido_em", "prazo"]}
              nomeArquivo={`sprint-report-${inicio}-a-${fim}.csv`}
              rotulo="Baixar CSV"
            />
            <BotaoExportarPDF />
          </div>
        )}
      </div>

      <p className="hidden font-display text-lg font-bold print:block">
        Caderno de Campo · PI 2026 — Sprint Report · {periodoFormatado}
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-2 print:hidden">
        <label className="font-mono text-xs uppercase text-tinta/70">
          De
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="mt-1 block border border-linha bg-casca px-3 py-2 font-corpo text-sm text-tinta"
          />
        </label>
        <label className="font-mono text-xs uppercase text-tinta/70">
          Até
          <input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="mt-1 block border border-linha bg-casca px-3 py-2 font-corpo text-sm text-tinta"
          />
        </label>
        <button
          onClick={gerar}
          disabled={carregando}
          className="bg-tinta px-4 py-2 text-sm font-semibold text-campo hover:bg-musgo disabled:opacity-50"
        >
          {carregando ? "Gerando…" : "Gerar relatório"}
        </button>
      </div>

      {gerado && (
        <div className="mt-8 space-y-10">
          <section>
            <h2 className="mb-3 flex items-baseline gap-2 border-b border-linha pb-1 font-display text-lg font-semibold">
              Tarefas concluídas
              <span className="font-mono text-xs font-normal text-tinta/70">{concluidas.length}</span>
            </h2>
            {concluidas.length === 0 ? (
              <p className="text-sm text-tinta/70">Nenhuma tarefa concluída no período.</p>
            ) : (
              <ul className="space-y-1">
                {concluidas.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-semibold">{t.titulo}</span>
                    <span className="font-mono text-xs text-tinta/70">
                      {responsaveisDe(t).map((m) => m.nome).join(", ") || "sem responsável"} ·{" "}
                      {t.concluido_em && dataCurta(t.concluido_em)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 flex items-baseline gap-2 border-b border-linha pb-1 font-display text-lg font-semibold">
              Passaram do prazo
              <span className="font-mono text-xs font-normal text-tinta/70">{atrasadas.length}</span>
            </h2>
            {atrasadas.length === 0 ? (
              <p className="text-sm text-tinta/70">Nenhuma, nesse período.</p>
            ) : (
              <ul className="space-y-1">
                {atrasadas.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-semibold text-trigo">{t.titulo}</span>
                    <span className="font-mono text-xs text-tinta/70">
                      {responsaveisDe(t).map((m) => m.nome).join(", ") || "sem responsável"} · prazo {t.prazo && new Date(t.prazo + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-8 sm:grid-cols-2">
            <section>
              <h2 className="mb-3 border-b border-linha pb-1 font-display text-lg font-semibold">
                Por pessoa
              </h2>
              <Barras dados={porPessoa} />
            </section>
            <section>
              <h2 className="mb-3 border-b border-linha pb-1 font-display text-lg font-semibold">
                Por unidade de estudo
              </h2>
              <Barras dados={porUnidade} />
            </section>
          </div>

          <section className="overflow-x-auto border border-linha">
            <h2 className="border-b border-linha bg-casca px-4 py-2 font-mono text-xs uppercase tracking-widest text-tinta/70">
              Resumo por pessoa no período
            </h2>
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-linha bg-casca font-mono text-xs uppercase tracking-wide text-tinta/70">
                  <th className="px-3 py-2 text-left">Pessoa</th>
                  <th className="px-3 py-2 text-left">Frente</th>
                  <th className="px-3 py-2 text-left">Concluídas individuais</th>
                  <th className="px-3 py-2 text-left">Concluídas de frente</th>
                  <th className="px-3 py-2 text-left">Unidades</th>
                  <th className="px-3 py-2 text-left">Movimentações na trilha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {resumoPorPessoa.map((p) => (
                  <tr key={p.nome}>
                    <td className="px-3 py-2 font-semibold">{p.nome}</td>
                    <td className="px-3 py-2 text-tinta/70">
                      {p.frente}
                      {p.unidadeFrente && <span className="text-tinta/70"> · {p.unidadeFrente}</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{p.individuais}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.deFrente}</td>
                    <td className="px-3 py-2 text-xs text-tinta/70">{p.unidades.join(", ") || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.movimentacoes}</td>
                  </tr>
                ))}
                {resumoPorPessoa.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-sm text-tinta/70">
                      Ninguém cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="mb-3 border-b border-linha pb-1 font-display text-lg font-semibold">
              Reuniões realizadas
              <span className="ml-2 font-mono text-xs font-normal text-tinta/70">{reunioes.length}</span>
            </h2>
            {reunioes.length === 0 ? (
              <p className="text-sm text-tinta/70">Nenhuma reunião registrada no período.</p>
            ) : (
              <ul className="space-y-1">
                {reunioes.map((r) => (
                  <li key={r.id} className="text-sm">
                    <span className="font-mono text-xs text-tinta/70">
                      {new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>{" "}
                    {r.pauta}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 border-b border-linha pb-1 font-display text-lg font-semibold">
              Principais movimentações da trilha
              <span className="ml-2 font-mono text-xs font-normal text-tinta/70">{movimentacoes.length}</span>
            </h2>
            <ul className="max-h-96 space-y-1 overflow-y-auto print:max-h-none print:overflow-visible">
              {movimentacoes.slice(0, 40).map((m, i) => (
                <li key={i} className="font-mono text-xs text-tinta/70">
                  {dataCurta(m.em)} · {m.autor ?? "—"} · {m.acao}
                  {m.tarefa ? ` · ${m.tarefa}` : ""}
                  {m.frente
                    ? ` · ${m.escopo === "frente" ? "frente" : "tema"}: ${m.frente}${
                        m.frente_unidade ? ` (${UNIDADES_FRENTE.find((u) => u.id === m.frente_unidade)?.nome ?? m.frente_unidade})` : ""
                      }`
                    : ""}
                </li>
              ))}
              {movimentacoes.length === 0 && (
                <p className="text-sm text-tinta/70">Nenhuma movimentação no período.</p>
              )}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function Barras({ dados }: { dados: Record<string, number> }) {
  const entradas = Object.entries(dados).sort((a, b) => b[1] - a[1]);
  const maior = Math.max(1, ...entradas.map(([, n]) => n));

  if (entradas.length === 0) {
    return <p className="text-sm text-tinta/70">Sem dados no período.</p>;
  }

  return (
    <div className="space-y-2">
      {entradas.map(([nome, total]) => (
        <div key={nome} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm">{nome}</span>
          <div className="h-3 flex-1 bg-linha">
            <div className="h-full bg-musgo" style={{ width: `${(total / maior) * 100}%` }} />
          </div>
          <span className="w-8 text-right font-mono text-xs text-tinta/70">{total}</span>
        </div>
      ))}
    </div>
  );
}
