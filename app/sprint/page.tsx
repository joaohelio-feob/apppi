"use client";

import { useCallback, useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataCurta, dataLocalISO } from "@/lib/datas";
import {
  UNIDADES_FRENTE,
  iniciaisDe,
  responsaveisDe,
  type Frente,
  type Membro,
  type Reuniao,
  type Tarefa,
} from "@/lib/types";
import BotaoExportarCSV from "@/components/BotaoExportarCSV";
import BotaoExportarPDF from "@/components/BotaoExportarPDF";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Botao from "@/components/ui/Botao";
import {
  IconeAlerta,
  IconeCheck,
  IconeReunioes,
  IconeSprint,
  IconeTrilha,
} from "@/components/ui/Icones";

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

function diasAtrasISO(dias: number) {
  return dataLocalISO(new Date(Date.now() - dias * 86_400_000));
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
  const [membros, setMembros] = useState<
    (Membro & { frentes?: Frente | null })[]
  >([]);

  const gerarPeriodo = useCallback(async (ini: string, fimPeriodo: string) => {
    setCarregando(true);
    const supabase = criarClienteNavegador();
    const fimFechado = `${fimPeriodo}T23:59:59`;

    const [
      { data: tarefasData },
      { data: reunioesData },
      { data: trilhaData },
      { data: membrosData },
    ] = await Promise.all([
      supabase
        .from("tarefas")
        .select(
          "id, titulo, concluido_em, prazo, escopo, status, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, unidade)",
        )
        .or(
          `and(concluido_em.gte.${ini},concluido_em.lte.${fimFechado}),and(prazo.gte.${ini},prazo.lte.${fimPeriodo})`,
        ),
      supabase
        .from("reunioes")
        .select("*")
        .gte("data", ini)
        .lte("data", fimPeriodo)
        .order("data"),
      supabase
        .from("relatorio_atividades")
        .select("em, autor, acao, tarefa, escopo, frente, frente_unidade")
        .gte("em", ini)
        .lte("em", fimFechado)
        .order("em", { ascending: false })
        .limit(200),
      supabase
        .from("membros")
        .select("id, nome, papel, frente_id, frentes(id, nome, unidade)"),
    ]);

    const todas = (tarefasData ?? []) as unknown as Tarefa[];
    setConcluidas(
      todas.filter(
        (t) =>
          t.concluido_em &&
          t.concluido_em >= ini &&
          t.concluido_em <= fimFechado,
      ),
    );
    setAtrasadas(
      todas
        .filter((t) => t.prazo && t.prazo >= ini && t.prazo <= fimPeriodo)
        .filter((t) => {
          if (!t.prazo) return false;
          if (t.concluido_em)
            return dataLocalISO(new Date(t.concluido_em)) > t.prazo;
          return t.status !== "concluida" && t.prazo < dataLocalISO();
        }),
    );

    setReunioes((reunioesData ?? []) as Reuniao[]);
    setMovimentacoes((trilhaData ?? []) as Movimentacao[]);
    setMembros(
      (membrosData ?? []) as unknown as (Membro & { frentes?: Frente | null })[],
    );
    setCarregando(false);
    setGerado(true);
  }, []);

  const gerar = useCallback(
    () => gerarPeriodo(inicio, fim),
    [gerarPeriodo, inicio, fim],
  );

  useEffect(() => {
    gerar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function aplicarAtalho(novoInicio: string) {
    const hoje = dataLocalISO();
    setInicio(novoInicio);
    setFim(hoje);
    void gerarPeriodo(novoInicio, hoje);
  }

  const porPessoa = concluidas.reduce<Record<string, number>>((acc, t) => {
    const responsaveis = responsaveisDe(t);
    if (responsaveis.length === 0) {
      acc["sem responsável"] = (acc["sem responsável"] ?? 0) + 1;
    } else {
      responsaveis.forEach((m) => {
        acc[m.nome] = (acc[m.nome] ?? 0) + 1;
      });
    }
    return acc;
  }, {});

  const porUnidade = concluidas.reduce<Record<string, number>>((acc, t) => {
    const nome = t.frentes?.unidade
      ? (UNIDADES_FRENTE.find((u) => u.id === t.frentes!.unidade)?.nome ??
        t.frentes.unidade)
      : "sem frente";
    acc[nome] = (acc[nome] ?? 0) + 1;
    return acc;
  }, {});

  const periodoFormatado = `${new Date(inicio + "T12:00:00").toLocaleDateString("pt-BR")} a ${new Date(
    fim + "T12:00:00",
  ).toLocaleDateString("pt-BR")}`;

  const movimentacoesPorAutor = movimentacoes.reduce<Record<string, number>>(
    (acc, m) => {
      const nome = m.autor ?? "desconhecido";
      acc[nome] = (acc[nome] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const resumoPorPessoa = membros.map((m) => {
    const dela = concluidas.filter((t) =>
      responsaveisDe(t).some((r) => r.id === m.id),
    );
    const individuais = dela.filter((t) => t.escopo === "individual");
    const deFrente = dela.filter((t) => t.escopo === "frente");
    const unidades = Array.from(
      new Set(
        dela
          .map((t) => t.frentes?.unidade)
          .filter((u): u is NonNullable<typeof u> => !!u)
          .map((u) => UNIDADES_FRENTE.find((x) => x.id === u)?.nome ?? u),
      ),
    );
    const frenteDela = m.frentes;
    return {
      nome: m.nome,
      frente: frenteDela?.nome ?? "sem frente",
      unidadeFrente:
        UNIDADES_FRENTE.find((u) => u.id === frenteDela?.unidade)?.nome ?? null,
      individuais: individuais.length,
      deFrente: deFrente.length,
      unidades,
      movimentacoes: movimentacoesPorAutor[m.nome] ?? 0,
    };
  });

  return (
    <div>
      <div className="print:hidden">
        <CabecalhoPagina
          categoria="Relatório por período"
          icone={<IconeSprint className="h-3.5 w-3.5 text-musgo" />}
          titulo="O que a equipe entregou no período"
          descricao="Selecione um recorte de datas para consolidar entregas, atrasos, participação e reuniões do sprint."
          acoes={
            gerado ? (
              <>
                <BotaoExportarCSV
                  linhas={concluidas.map((t) => ({
                    tarefa: t.titulo,
                    responsavel: responsaveisDe(t)
                      .map((m) => m.nome)
                      .join(", "),
                    escopo: t.escopo,
                    frente: t.frentes?.nome ?? "",
                    frente_unidade: t.frentes?.unidade ?? "",
                    concluido_em: t.concluido_em,
                    prazo: t.prazo,
                  }))}
                  colunas={[
                    "tarefa",
                    "responsavel",
                    "escopo",
                    "frente",
                    "frente_unidade",
                    "concluido_em",
                    "prazo",
                  ]}
                  nomeArquivo={`sprint-report-${inicio}-a-${fim}.csv`}
                  rotulo="Baixar CSV"
                />
                <BotaoExportarPDF />
              </>
            ) : undefined
          }
        />
      </div>

      <p className="hidden font-display text-lg font-bold print:block">
        Caderno de Campo · PI 2026 — Sprint Report · {periodoFormatado}
      </p>

      <div className="cartao mb-6 p-4 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-tinta/70">
              De
              <input
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="campo mt-1 font-mono"
              />
            </label>
            <label className="text-xs font-semibold text-tinta/70">
              Até
              <input
                type="date"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                className="campo mt-1 font-mono"
              />
            </label>
            <Botao variante="destaque" onClick={gerar} disabled={carregando}>
              {carregando ? "Gerando…" : "Gerar relatório"}
            </Botao>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-tinta/70">
              Atalhos:
            </span>
            <button
              type="button"
              disabled={carregando}
              onClick={() => aplicarAtalho(diasAtrasISO(7))}
              className="botao botao-secundario min-h-8 px-2.5 py-1 text-xs"
            >
              Últimos 7 dias
            </button>
            <button
              type="button"
              disabled={carregando}
              onClick={() => aplicarAtalho(diasAtrasISO(15))}
              className="botao botao-secundario min-h-8 px-2.5 py-1 text-xs"
            >
              Últimos 15 dias
            </button>
            <button
              type="button"
              disabled={carregando}
              onClick={() => aplicarAtalho(primeiroDiaDoMes())}
              className="botao botao-secundario min-h-8 px-2.5 py-1 text-xs"
            >
              Este mês
            </button>
          </div>
        </div>
      </div>

      {gerado && (
        <div className="space-y-6">
          {/* 4 KPI cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="cartao border-l-4 border-l-musgo p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-tinta/70">
                <IconeCheck className="h-3.5 w-3.5 text-musgo" />
                Concluídas
              </p>
              <p className="mt-1 font-display text-3xl font-extrabold text-tinta">
                {concluidas.length}
              </p>
            </div>
            <div
              className={`cartao border-l-4 p-4 ${atrasadas.length > 0 ? "border-l-trigo" : "border-l-linha"}`}
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold text-tinta/70">
                <IconeAlerta className="h-3.5 w-3.5 text-tinta" />
                Passaram do prazo
              </p>
              <p className="mt-1 font-display text-3xl font-extrabold text-tinta">
                {atrasadas.length}
              </p>
            </div>
            <div className="cartao border-l-4 border-l-ferro p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-tinta/70">
                <IconeReunioes className="h-3.5 w-3.5 text-ferro" />
                Reuniões
              </p>
              <p className="mt-1 font-display text-3xl font-extrabold text-tinta">
                {reunioes.length}
              </p>
            </div>
            <div className="cartao border-l-4 border-l-broto p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-tinta/70">
                <IconeTrilha className="h-3.5 w-3.5 text-musgo" />
                Movimentações
              </p>
              <p className="mt-1 font-display text-3xl font-extrabold text-tinta">
                {movimentacoes.length}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="cartao p-5">
              <h2 className="mb-3 flex items-center justify-between border-b border-linha pb-2 font-display text-base font-bold text-tinta">
                <span>Tarefas concluídas</span>
                <span className="rounded-full bg-casca px-2.5 py-0.5 font-mono text-xs text-tinta">
                  {concluidas.length}
                </span>
              </h2>
              {concluidas.length === 0 ? (
                <p className="text-sm text-tinta/70">
                  Nenhuma tarefa concluída no período.
                </p>
              ) : (
                <ul className="space-y-2">
                  {concluidas.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-linha/70 bg-campo/50 px-3 py-2 text-sm"
                    >
                      <span className="font-semibold text-tinta">
                        {t.titulo}
                      </span>
                      <span className="font-mono text-xs text-tinta/70">
                        {responsaveisDe(t)
                          .map((m) => m.nome)
                          .join(", ") || "sem responsável"}{" "}
                        · {t.concluido_em && dataCurta(t.concluido_em)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="cartao p-5">
              <h2 className="mb-3 flex items-center justify-between border-b border-linha pb-2 font-display text-base font-bold text-tinta">
                <span>Passaram do prazo</span>
                <span className="rounded-full bg-casca px-2.5 py-0.5 font-mono text-xs text-tinta">
                  {atrasadas.length}
                </span>
              </h2>
              {atrasadas.length === 0 ? (
                <p className="text-sm text-tinta/70">Nenhuma, nesse período.</p>
              ) : (
                <ul className="space-y-2">
                  {atrasadas.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-trigo/60 bg-trigo/10 px-3 py-2 text-sm"
                    >
                      <span className="font-semibold text-tinta">
                        {t.titulo}
                      </span>
                      <span className="font-mono text-xs text-tinta/70">
                        {responsaveisDe(t)
                          .map((m) => m.nome)
                          .join(", ") || "sem responsável"}{" "}
                        · prazo{" "}
                        {t.prazo &&
                          new Date(t.prazo + "T12:00:00").toLocaleDateString(
                            "pt-BR",
                          )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <section className="cartao p-5">
              <h2 className="mb-3 border-b border-linha pb-2 font-display text-base font-bold text-tinta">
                Entregas por pessoa
              </h2>
              <Barras dados={porPessoa} />
            </section>
            <section className="cartao p-5">
              <h2 className="mb-3 border-b border-linha pb-2 font-display text-base font-bold text-tinta">
                Entregas por unidade de estudo
              </h2>
              <Barras dados={porUnidade} />
            </section>
          </div>

          <section className="cartao max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible">
            <h2 className="border-b border-linha bg-casca px-4 py-3 font-display text-sm font-bold text-tinta">
              Resumo por pessoa no período
            </h2>
            <table className="tabela-edicao min-w-[640px]">
              <thead>
                <tr className="border-b border-linha bg-casca font-display text-xs font-semibold text-tinta/70">
                  <th className="px-4 py-2.5 text-left">Pessoa</th>
                  <th className="px-4 py-2.5 text-left">Frente</th>
                  <th className="px-4 py-2.5 text-left">
                    Concluídas individuais
                  </th>
                  <th className="px-4 py-2.5 text-left">
                    Concluídas de frente
                  </th>
                  <th className="px-4 py-2.5 text-left">Unidades</th>
                  <th className="px-4 py-2.5 text-left">
                    Movimentações na trilha
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linha/80">
                {resumoPorPessoa.map((p) => (
                  <tr key={p.nome}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-musgo font-mono text-xs font-semibold text-campo"
                        >
                          {iniciaisDe(p.nome)}
                        </span>
                        <span className="font-semibold text-tinta">
                          {p.nome}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-tinta/70">
                      {p.frente}
                      {p.unidadeFrente && (
                        <span className="text-tinta/70">
                          {" "}
                          · {p.unidadeFrente}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-tinta">
                      {p.individuais}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-tinta">
                      {p.deFrente}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-tinta/70">
                      {p.unidades.join(", ") || "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-tinta">
                      {p.movimentacoes}
                    </td>
                  </tr>
                ))}
                {resumoPorPessoa.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-tinta/70"
                    >
                      Ninguém cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="cartao p-5">
              <h2 className="mb-3 flex items-center justify-between border-b border-linha pb-2 font-display text-base font-bold text-tinta">
                <span>Reuniões realizadas</span>
                <span className="rounded-full bg-casca px-2.5 py-0.5 font-mono text-xs text-tinta">
                  {reunioes.length}
                </span>
              </h2>
              {reunioes.length === 0 ? (
                <p className="text-sm text-tinta/70">
                  Nenhuma reunião registrada no período.
                </p>
              ) : (
                <ul className="space-y-2">
                  {reunioes.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-linha/70 bg-campo/50 px-3 py-2 text-sm text-tinta"
                    >
                      <span className="mr-2 font-mono text-xs font-semibold text-musgo">
                        {new Date(r.data + "T12:00:00").toLocaleDateString(
                          "pt-BR",
                        )}
                      </span>
                      {r.pauta}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="cartao p-5">
              <h2 className="mb-3 flex items-center justify-between border-b border-linha pb-2 font-display text-base font-bold text-tinta">
                <span>Principais movimentações da trilha</span>
                <span className="rounded-full bg-casca px-2.5 py-0.5 font-mono text-xs text-tinta">
                  {movimentacoes.length}
                </span>
              </h2>
              <ul className="max-h-96 space-y-1.5 overflow-y-auto print:max-h-none print:overflow-visible">
                {movimentacoes.slice(0, 40).map((m, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-campo/60 px-2.5 py-1.5 font-mono text-xs text-tinta/70"
                  >
                    {dataCurta(m.em)} ·{" "}
                    <strong className="text-tinta">{m.autor ?? "—"}</strong> ·{" "}
                    {m.acao}
                    {m.tarefa ? ` · ${m.tarefa}` : ""}
                    {m.frente
                      ? ` · ${m.escopo === "frente" ? "frente" : "tema"}: ${m.frente}${
                          m.frente_unidade
                            ? ` (${UNIDADES_FRENTE.find((u) => u.id === m.frente_unidade)?.nome ?? m.frente_unidade})`
                            : ""
                        }`
                      : ""}
                  </li>
                ))}
                {movimentacoes.length === 0 && (
                  <p className="text-sm text-tinta/70">
                    Nenhuma movimentação no período.
                  </p>
                )}
              </ul>
            </section>
          </div>
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
    <div className="space-y-2.5">
      {entradas.map(([nome, total]) => (
        <div key={nome} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-sm font-medium text-tinta">
            {nome}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-linha">
            <div
              className="h-full rounded-full bg-musgo"
              style={{ width: `${(total / maior) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right font-mono text-xs font-semibold text-tinta">
            {total}
          </span>
        </div>
      ))}
    </div>
  );
}
