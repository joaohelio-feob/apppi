"use client";

import { useAtualizacaoTarefas } from "@/lib/useAtualizacaoTarefas";
import { useCallback, useEffect, useMemo, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataLocalISO, estaAtrasada } from "@/lib/datas";
import {
  CLASSES_PRIORIDADE,
  PRIORIDADES,
  STATUS,
  responsaveisDe,
  type EstadoEntrega,
  type Frente,
  type Membro,
  type Tarefa,
} from "@/lib/types";
import LinhaTarefa from "@/components/LinhaTarefa";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import { useDetalheTarefa } from "@/components/DetalheTarefaProvider";
import { IconeCalendario } from "@/components/ui/Icones";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Quantos itens um dia mostra antes do "+N". */
const VISIVEIS_POR_DIA = 3;

export default function Calendario() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [estados, setEstados] = useState<Map<number, EstadoEntrega>>(new Map());
  const [responsavel, setResponsavel] = useState("");
  const abrirDetalhe = useDetalheTarefa();
  /** Dias com "+N" aberto, por data ISO — chave estável, não índice. */
  const [diasAbertos, setDiasAbertos] = useState<Set<string>>(new Set());
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const carregar = useCallback(async () => {
    const supabase = criarClienteNavegador();
    const [
      { data: t, error: erroT },
      { data: m, error: erroM },
      { data: f, error: erroF },
      { data: e, error: erroE },
    ] = await Promise.all([
      supabase
        .from("tarefas")
        .select(
          "id, titulo, descricao, escopo, frente_id, status, prioridade, prazo, inicio, local_entrega, subiu_git, issue_numero, observacoes, revisor_id, commit_confirmado_em, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, cor, unidade)",
        )
        .eq("arquivada", false)
        .not("prazo", "is", null),
      supabase
        .from("membros")
        .select("id, nome, papel, frente_id")
        .order("nome"),
      supabase.from("frentes").select("id, nome").order("nome"),
      supabase
        .from("tarefas_estado_entrega")
        .select("tarefa_id, ultimo_resultado, entregue_em, revisado_em"),
    ]);
    setCarregando(false);
    setErro(!!(erroT || erroM || erroF || erroE));
    if (erroT || erroM || erroF || erroE) return;
    setTarefas((t ?? []) as unknown as Tarefa[]);
    setMembros((m ?? []) as Membro[]);
    setFrentes((f ?? []) as Frente[]);
    setEstados(
      new Map((e ?? []).map((x) => [x.tarefa_id, x as EstadoEntrega])),
    );
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useAtualizacaoTarefas("calendario", carregar);
  const hojeIso = dataLocalISO();

  function alternarDia(iso: string) {
    setDiasAbertos((atual) => {
      const nova = new Set(atual);
      if (nova.has(iso)) nova.delete(iso);
      else nova.add(iso);
      return nova;
    });
  }

  const visiveis = useMemo(
    () =>
      responsavel
        ? tarefas.filter((t) =>
            responsaveisDe(t).some((m) => m.id === responsavel),
          )
        : tarefas,
    [tarefas, responsavel],
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
    const PESO: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
    Object.values(mapa).forEach((lista) =>
      lista.sort((a, b) => {
        const atrasoA = estaAtrasada(a.status, a.prazo, hojeIso) ? 0 : 1;
        const atrasoB = estaAtrasada(b.status, b.prazo, hojeIso) ? 0 : 1;
        if (atrasoA !== atrasoB) return atrasoA - atrasoB;
        if (PESO[a.prioridade] !== PESO[b.prioridade])
          return PESO[a.prioridade] - PESO[b.prioridade];
        return a.titulo.localeCompare(b.titulo);
      }),
    );
    return mapa;
  }, [visiveis, hojeIso]);

  const ajustesPendentes = useMemo(
    () =>
      new Set(
        Array.from(estados.values())
          .filter(
            (e) =>
              e.ultimo_resultado === "falta_algo" &&
              e.revisado_em &&
              (!e.entregue_em ||
                new Date(e.revisado_em) > new Date(e.entregue_em)),
          )
          .map((e) => e.tarefa_id),
      ),
    [estados],
  );

  const chave = (dia: number) =>
    `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  const tituloMes = mes.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const nomeFiltro = responsavel
    ? membros.find((m) => m.id === responsavel)?.nome
    : null;

  return (
    <div>
      <CabecalhoPagina
        categoria={
          nomeFiltro ? `Calendário pessoal · ${nomeFiltro}` : "Calendário geral"
        }
        icone={<IconeCalendario className="h-3.5 w-3.5 text-musgo" />}
        titulo={tituloMes.charAt(0).toUpperCase() + tituloMes.slice(1)}
        descricao="Prazos distribuídos no mês. Clique em qualquer tarefa para abrir detalhes, checklist ou entregar."
        acoes={
          <>
            <select
              aria-label="Filtrar calendário por responsável"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className="campo w-auto py-2 text-xs font-medium"
            >
              <option value="">Todo mundo</option>
              {membros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))
              }
              className="botao botao-secundario min-h-9 px-3 py-1.5 font-mono text-xs"
            >
              ← Anterior
            </button>
            <button
              type="button"
              onClick={() => {
                const agora = new Date();
                setMes(new Date(agora.getFullYear(), agora.getMonth(), 1));
              }}
              className="botao botao-primario min-h-9 px-3 py-1.5 font-mono text-xs"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() =>
                setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))
              }
              className="botao botao-secundario min-h-9 px-3 py-1.5 font-mono text-xs"
            >
              Próximo →
            </button>
          </>
        }
      />

      {/* Legenda didática acima da grade */}
      <section
        aria-label="Legenda do calendário"
        className="cartao mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      >
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="font-semibold text-tinta">Status:</span>
          {STATUS.map((s) => (
            <span
              key={s.id}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold ${s.cor}`}
            >
              {s.nome}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-tinta/70">
          <span className="font-semibold text-tinta">Sinais:</span>
          {PRIORIDADES.map((p) => (
            <span
              key={p.id}
              className="rounded-md border border-linha bg-campo px-2 py-0.5"
            >
              {CLASSES_PRIORIDADE[p.id].glifo} {p.nome.toLowerCase()}
            </span>
          ))}
          <span className="rounded-md border border-trigo bg-trigo/20 px-2 py-0.5 font-semibold text-tinta">
            ! atrasada
          </span>
          <span className="rounded-md border border-ferro bg-ferro/10 px-2 py-0.5 font-semibold text-tinta">
            ↩ ajuste pedido
          </span>
        </div>
      </section>

      {carregando && (
        <p role="status" className="mt-4 text-sm text-tinta/70">
          Carregando calendário…
        </p>
      )}
      {erro && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-trigo bg-trigo/15 px-4 py-3 text-sm text-tinta"
        >
          Não foi possível carregar o calendário.{" "}
          <button type="button" className="font-semibold underline" onClick={carregar}>
            Tentar novamente
          </button>
        </p>
      )}

      {/* Grade desktop — preserva rigorosamente atraso > prioridade > status */}
      <div className="hidden overflow-hidden rounded-xl border border-linha bg-linha shadow-cartao sm:grid sm:grid-cols-7 sm:gap-px">
        {DIAS.map((d) => (
          <div
            key={d}
            className="bg-casca px-2.5 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-tinta/70"
          >
            {d}
          </div>
        ))}

        {celulas.map((dia, i) => {
          if (dia === null)
            return <div key={`v${i}`} className="min-h-[104px] bg-campo/60" />;
          const iso = chave(dia);
          const doDia = porDia[iso] ?? [];
          const ehHoje = iso === hojeIso;
          const expandido = diasAbertos.has(iso);

          return (
            <div
              key={iso}
              className={`min-h-[104px] bg-papel p-2 ${
                ehHoje ? "ring-2 ring-inset ring-musgo" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-mono text-xs ${
                    ehHoje
                      ? "bg-tinta font-bold text-campo"
                      : "text-tinta/70"
                  }`}
                >
                  {String(dia).padStart(2, "0")}
                </span>
                {ehHoje && (
                  <span className="font-mono text-xs font-semibold text-musgo">
                    hoje
                  </span>
                )}
              </div>

              <div className="mt-1.5 space-y-1">
                {(expandido ? doDia : doDia.slice(0, VISIVEIS_POR_DIA)).map(
                  (t) => {
                    const cor =
                      STATUS.find((s) => s.id === t.status)?.cor ?? "";
                    const prio = CLASSES_PRIORIDADE[t.prioridade];
                    const nomePrio =
                      PRIORIDADES.find((p) => p.id === t.prioridade)?.nome ??
                      t.prioridade;
                    const atrasada = estaAtrasada(t.status, t.prazo, hojeIso);
                    const faltaAlgo = ajustesPendentes.has(t.id);
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() =>
                          abrirDetalhe({
                            tarefa: t,
                            aoAtualizar: carregar,
                            membrosIniciais: membros,
                            frentesIniciais: frentes,
                          })
                        }
                        title={`${t.titulo} · ${
                          responsaveisDe(t)
                            .map((m) => m.nome)
                            .join(", ") || "sem responsável"
                        } · prioridade ${nomePrio}${atrasada ? " · atrasada" : ""}${faltaAlgo ? " · revisor pediu ajuste, veja o detalhe" : ""}`}
                        className={`grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-x-1 rounded-sm px-1.5 py-1 text-left text-xs leading-tight transition-opacity duration-micro ease-entrada hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tinta ${cor} ${prio.borda} ${
                          atrasada
                            ? "font-semibold ring-1 ring-inset ring-trigo"
                            : ""
                        }`}
                      >
                        <span aria-hidden="true" className="font-mono">
                          {atrasada ? "!" : ""}
                          {faltaAlgo ? "↩" : ""}
                          {prio.glifo}
                        </span>
                        <span className="line-clamp-2 break-words">
                          {t.titulo}
                        </span>
                      </button>
                    );
                  },
                )}
                {doDia.length > VISIVEIS_POR_DIA && (
                  <button
                    type="button"
                    onClick={() => alternarDia(iso)}
                    aria-expanded={expandido}
                    aria-label={
                      expandido
                        ? `ver menos no dia ${dia}`
                        : `ver mais ${doDia.length - VISIVEIS_POR_DIA} no dia ${dia}`
                    }
                    className="w-full rounded px-1 py-0.5 text-left font-mono text-xs font-semibold text-musgo underline underline-offset-2 transition-opacity duration-micro ease-entrada hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tinta"
                  >
                    {expandido
                      ? "ver menos"
                      : `+${doDia.length - VISIVEIS_POR_DIA} mais`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Agenda mobile */}
      <section aria-label="Agenda do mês" className="mt-5 space-y-4 sm:hidden">
        {celulas
          .filter(
            (dia): dia is number =>
              dia !== null && !!porDia[chave(dia)]?.length,
          )
          .map((dia) => (
            <div key={dia} className="cartao overflow-hidden">
              <h2
                className={`border-b border-linha px-4 py-2.5 font-mono text-sm ${
                  chave(dia) === hojeIso
                    ? "bg-tinta font-semibold text-campo"
                    : "bg-casca text-tinta"
                }`}
              >
                {String(dia).padStart(2, "0")} ·{" "}
                {new Date(
                  mes.getFullYear(),
                  mes.getMonth(),
                  dia,
                ).toLocaleDateString("pt-BR", { weekday: "long" })}
                {chave(dia) === hojeIso ? " · Hoje" : ""}
              </h2>
              <div className="p-2">
                {porDia[chave(dia)].map((t) => (
                  <div key={t.id}>
                    <LinhaTarefa
                      tarefa={t}
                      mostrarStatus
                      membros={membros}
                      frentes={frentes}
                      aoAtualizar={carregar}
                    />
                    {ajustesPendentes.has(t.id) && (
                      <p className="px-3 pb-2 text-xs font-medium text-tinta">
                        ↩ Revisor pediu ajuste — abra os detalhes.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        {!carregando &&
          !erro &&
          !celulas.some(
            (dia) => dia !== null && porDia[chave(dia)]?.length,
          ) && (
            <div className="cartao p-6 text-center text-sm text-tinta/70">
              Nenhum prazo marcado neste mês.
            </div>
          )}
      </section>
    </div>
  );
}
