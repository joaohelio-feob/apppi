"use client";

import { useCallback, useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataLocalISO } from "@/lib/datas";
import { UNIDADES, type Reuniao, type Tarefa } from "@/lib/types";
import BotaoExportarCSV from "@/components/BotaoExportarCSV";
import BotaoExportarPDF from "@/components/BotaoExportarPDF";

type Movimentacao = {
  em: string;
  autor: string | null;
  acao: string;
  tarefa: string | null;
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

  const gerar = useCallback(async () => {
    setCarregando(true);
    const supabase = criarClienteNavegador();
    const fimFechado = `${fim}T23:59:59`;

    const [{ data: concluidasData }, { data: doPrazoData }, { data: reunioesData }, { data: trilhaData }] =
      await Promise.all([
        supabase
          .from("tarefas")
          .select("*, membros:responsavel_id(id, nome, papel)")
          .gte("concluido_em", inicio)
          .lte("concluido_em", fimFechado),
        supabase
          .from("tarefas")
          .select("*, membros:responsavel_id(id, nome, papel)")
          .gte("prazo", inicio)
          .lte("prazo", fim),
        supabase.from("reunioes").select("*").gte("data", inicio).lte("data", fim).order("data"),
        supabase
          .from("relatorio_atividades")
          .select("em, autor, acao, tarefa")
          .gte("em", inicio)
          .lte("em", fimFechado)
          .order("em", { ascending: false })
          .limit(200),
      ]);

    setConcluidas((concluidasData ?? []) as Tarefa[]);

    const noPrazo = (doPrazoData ?? []) as Tarefa[];
    setAtrasadas(
      noPrazo.filter((t) => {
        if (!t.prazo) return false;
        if (t.concluido_em) return dataLocalISO(new Date(t.concluido_em)) > t.prazo;
        return t.status !== "concluida" && t.prazo < dataLocalISO();
      })
    );

    setReunioes((reunioesData ?? []) as Reuniao[]);
    setMovimentacoes((trilhaData ?? []) as Movimentacao[]);
    setCarregando(false);
    setGerado(true);
  }, [inicio, fim]);

  useEffect(() => { gerar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const porPessoa = concluidas.reduce<Record<string, number>>((acc, t) => {
    const nome = t.membros?.nome ?? "sem responsável";
    acc[nome] = (acc[nome] ?? 0) + 1;
    return acc;
  }, {});

  const porUnidade = concluidas.reduce<Record<string, number>>((acc, t) => {
    const nome = UNIDADES.find((u) => u.id === t.unidade)?.nome ?? t.unidade;
    acc[nome] = (acc[nome] ?? 0) + 1;
    return acc;
  }, {});

  const periodoFormatado = `${new Date(inicio + "T12:00:00").toLocaleDateString("pt-BR")} a ${new Date(
    fim + "T12:00:00"
  ).toLocaleDateString("pt-BR")}`;

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
                responsavel: t.membros?.nome ?? "",
                unidade: t.unidade,
                concluido_em: t.concluido_em,
                prazo: t.prazo,
              }))}
              colunas={["tarefa", "responsavel", "unidade", "concluido_em", "prazo"]}
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
        <label className="font-mono text-[11px] uppercase text-tinta/60">
          De
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="mt-1 block border border-linha bg-casca px-3 py-2 font-corpo text-sm text-tinta"
          />
        </label>
        <label className="font-mono text-[11px] uppercase text-tinta/60">
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
              <span className="font-mono text-xs font-normal text-tinta/50">{concluidas.length}</span>
            </h2>
            {concluidas.length === 0 ? (
              <p className="text-sm text-tinta/50">Nenhuma tarefa concluída no período.</p>
            ) : (
              <ul className="space-y-1">
                {concluidas.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-semibold">{t.titulo}</span>
                    <span className="font-mono text-xs text-tinta/50">
                      {t.membros?.nome ?? "sem responsável"} ·{" "}
                      {t.concluido_em && new Date(t.concluido_em).toLocaleDateString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 flex items-baseline gap-2 border-b border-linha pb-1 font-display text-lg font-semibold">
              Passaram do prazo
              <span className="font-mono text-xs font-normal text-tinta/50">{atrasadas.length}</span>
            </h2>
            {atrasadas.length === 0 ? (
              <p className="text-sm text-tinta/50">Nenhuma, nesse período.</p>
            ) : (
              <ul className="space-y-1">
                {atrasadas.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-semibold text-trigo">{t.titulo}</span>
                    <span className="font-mono text-xs text-tinta/50">
                      {t.membros?.nome ?? "sem responsável"} · prazo {t.prazo && new Date(t.prazo + "T12:00:00").toLocaleDateString("pt-BR")}
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

          <section>
            <h2 className="mb-3 border-b border-linha pb-1 font-display text-lg font-semibold">
              Reuniões realizadas
              <span className="ml-2 font-mono text-xs font-normal text-tinta/50">{reunioes.length}</span>
            </h2>
            {reunioes.length === 0 ? (
              <p className="text-sm text-tinta/50">Nenhuma reunião registrada no período.</p>
            ) : (
              <ul className="space-y-1">
                {reunioes.map((r) => (
                  <li key={r.id} className="text-sm">
                    <span className="font-mono text-xs text-tinta/50">
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
              <span className="ml-2 font-mono text-xs font-normal text-tinta/50">{movimentacoes.length}</span>
            </h2>
            <ul className="max-h-96 space-y-1 overflow-y-auto print:max-h-none print:overflow-visible">
              {movimentacoes.slice(0, 40).map((m, i) => (
                <li key={i} className="font-mono text-xs text-tinta/60">
                  {new Date(m.em).toLocaleDateString("pt-BR")} · {m.autor ?? "—"} · {m.acao}
                  {m.tarefa ? ` · ${m.tarefa}` : ""}
                </li>
              ))}
              {movimentacoes.length === 0 && (
                <p className="text-sm text-tinta/50">Nenhuma movimentação no período.</p>
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
    return <p className="text-sm text-tinta/50">Sem dados no período.</p>;
  }

  return (
    <div className="space-y-2">
      {entradas.map(([nome, total]) => (
        <div key={nome} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm">{nome}</span>
          <div className="h-3 flex-1 bg-linha">
            <div className="h-full bg-musgo" style={{ width: `${(total / maior) * 100}%` }} />
          </div>
          <span className="w-8 text-right font-mono text-xs text-tinta/60">{total}</span>
        </div>
      ))}
    </div>
  );
}
