"use client";

import { useAtualizacaoTarefas } from "@/lib/useAtualizacaoTarefas";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Botao from "./ui/Botao";
import FluxoTarefa from "./ui/FluxoTarefa";
import { useNovaTarefa } from "./NovaTarefaProvider";
import LinhaTarefa from "@/components/LinhaTarefa";
import { responsaveisDe, type Tarefa } from "@/lib/types";
import {
  IconeAlerta,
  IconeCalendario,
  IconeCheck,
  IconeDica,
  IconeEquipe,
  IconeMais,
  IconeQuadro,
  IconeRelogio,
  IconeRevisoes,
  IconeSetaDireita,
  IconeUsuario,
} from "./ui/Icones";

const CHAVE_MINHAS = "pi-semana-somente-minhas";
const CHAVE_GUIA_OCULTO = "pi-guia-ciclo-oculto";

export default function PainelSemana({
  atrasadas,
  daSemana,
  depois,
  meuId,
  revisoesPendentes,
  erroRevisoes,
  totalConcluidas = 0,
  dataHoje,
}: {
  atrasadas: Tarefa[];
  daSemana: Tarefa[];
  depois: Tarefa[];
  meuId: string | null;
  revisoesPendentes: Tarefa[];
  erroRevisoes: boolean;
  totalConcluidas?: number;
  dataHoje: string;
}) {
  const { abrir } = useNovaTarefa();
  const [somenteMinhas, setSomenteMinhas] = useState(false);
  const [guiaVisivel, setGuiaVisivel] = useState(true);
  const router = useRouter();
  useAtualizacaoTarefas("semana", () => router.refresh());

  useEffect(() => {
    setSomenteMinhas(localStorage.getItem(CHAVE_MINHAS) === "1");
    setGuiaVisivel(localStorage.getItem(CHAVE_GUIA_OCULTO) !== "1");
  }, []);

  function alternar() {
    setSomenteMinhas((atual) => {
      const novo = !atual;
      localStorage.setItem(CHAVE_MINHAS, novo ? "1" : "0");
      return novo;
    });
  }

  function alternarGuia() {
    setGuiaVisivel((atual) => {
      const proximo = !atual;
      localStorage.setItem(CHAVE_GUIA_OCULTO, proximo ? "0" : "1");
      return proximo;
    });
  }

  const filtrar = (lista: Tarefa[]) =>
    somenteMinhas
      ? lista.filter((t) => responsaveisDe(t).some((m) => m.id === meuId))
      : lista;

  const atualizar = () => router.refresh();

  const vencidas = filtrar(atrasadas);
  const revisoesFiltradas = somenteMinhas
    ? revisoesPendentes.filter(
        (t) =>
          t.revisor_id === meuId ||
          responsaveisDe(t).some((m) => m.id === meuId),
      )
    : revisoesPendentes;
  const semana = filtrar(daSemana).filter((t) => t.status !== "revisao");
  const adiante = filtrar(depois).filter((t) => t.status !== "revisao");

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <section className="rounded-xl border-b-4 border-b-broto bg-tinta p-6 text-campo shadow-destaque">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-campo/15 px-3 py-1 font-mono text-xs font-semibold text-campo">
              <IconeCalendario className="h-3.5 w-3.5 text-broto" />
              {dataHoje}
            </span>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Semana do Projeto Integrador
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-campo/85">
              Veja o que vence primeiro, acompanhe entregas em revisão e
              mantenha as evidências do grupo em dia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Botao variante="destaque" onClick={abrir}>
              <IconeMais className="h-4 w-4" />
              Nova tarefa{" "}
              <kbd className="rounded bg-tinta/15 px-1.5 py-0.5 font-mono text-xs">
                N
              </kbd>
            </Botao>
            <Link
              href="/tarefas"
              className="botao border-campo/25 bg-campo/10 text-campo hover:bg-campo/20"
            >
              <IconeQuadro className="h-4 w-4" />
              Abrir Quadro
              <IconeSetaDireita className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 4 Cartões KPI */}
      <section
        aria-label="Resumo numérico da semana"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <CartaoKPI
          rotulo="Atrasadas"
          valor={vencidas.length}
          detalhe={
            vencidas.length === 0 ? "Tudo em dia!" : "Pedem atenção imediata"
          }
          borda={vencidas.length > 0 ? "border-l-trigo" : "border-l-musgo"}
          fundoIcone={
            vencidas.length > 0
              ? "bg-trigo/20 text-tinta"
              : "bg-musgo/15 text-musgo"
          }
          icone={
            vencidas.length > 0 ? (
              <IconeAlerta className="h-4 w-4" />
            ) : (
              <IconeCheck className="h-4 w-4" />
            )
          }
        />
        <Link
          href="/revisoes"
          className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-musgo"
        >
          <CartaoKPI
            rotulo="Em revisão"
            valor={erroRevisoes ? "—" : revisoesFiltradas.length}
            detalhe="Abrir fila de revisões →"
            borda="border-l-ferro"
            fundoIcone="bg-ferro/15 text-ferro"
            icone={<IconeRevisoes className="h-4 w-4" />}
            interativo
          />
        </Link>
        <CartaoKPI
          rotulo="Próximos 7 dias"
          valor={semana.length}
          detalhe="Com prazo nesta semana"
          borda="border-l-broto"
          fundoIcone="bg-broto/25 text-tinta"
          icone={<IconeRelogio className="h-4 w-4" />}
        />
        <CartaoKPI
          rotulo="Concluídas no PI"
          valor={totalConcluidas}
          detalhe="Provas salvas na Trilha"
          borda="border-l-musgo"
          fundoIcone="bg-musgo text-campo"
          icone={<IconeCheck className="h-4 w-4" />}
        />
      </section>

      {/* Bloco didático do ciclo de 5 passos */}
      <section className="cartao p-4 sm:p-5 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-broto/25 text-tinta">
              <IconeDica className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-tinta">
                Como funciona o ciclo de uma tarefa no PI
              </h2>
              <p className="text-xs text-tinta/70">
                Do planejamento à evidência avaliada pelos professores.
              </p>
            </div>
          </div>
          <Botao
            variante="secundario"
            onClick={alternarGuia}
            className="min-h-8 px-3 py-1 text-xs"
          >
            {guiaVisivel ? "Ocultar guia" : "Ver como funciona o fluxo de tarefas"}
          </Botao>
        </div>

        {guiaVisivel && (
          <div className="mt-4">
            <FluxoTarefa modo="guia" />
          </div>
        )}
      </section>

      {/* Barra de filtro segmentado */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-linha bg-papel px-4 py-3 shadow-cartao">
        <div
          className="flex gap-1 rounded-lg border border-linha bg-casca p-1"
          aria-label="Responsáveis pelas tarefas"
        >
          <button
            type="button"
            disabled={!meuId}
            aria-pressed={somenteMinhas}
            onClick={() => {
              if (!somenteMinhas) alternar();
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-micro ease-entrada disabled:opacity-50 ${
              somenteMinhas
                ? "bg-papel text-tinta shadow-cartao"
                : "text-tinta/70 hover:text-tinta"
            }`}
          >
            <IconeUsuario className="h-3.5 w-3.5" />
            Minhas tarefas
          </button>
          <button
            type="button"
            aria-pressed={!somenteMinhas}
            onClick={() => {
              if (somenteMinhas) alternar();
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-micro ease-entrada ${
              !somenteMinhas
                ? "bg-papel text-tinta shadow-cartao"
                : "text-tinta/70 hover:text-tinta"
            }`}
          >
            <IconeEquipe className="h-3.5 w-3.5" />
            Toda a equipe
          </button>
        </div>

        <p className="text-xs text-tinta/70">
          Clique em qualquer tarefa abaixo para editar critérios, prazo ou
          registrar entrega.
        </p>
      </div>

      {/* 1. Atrasadas */}
      <section
        aria-labelledby="sec-atraso"
        className={`cartao p-4 sm:p-5 ${
          vencidas.length > 0 ? "border-l-4 border-l-trigo" : ""
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                vencidas.length > 0
                  ? "bg-trigo text-tinta"
                  : "bg-musgo/15 text-musgo"
              }`}
            >
              {vencidas.length > 0 ? (
                <IconeAlerta className="h-4 w-4" />
              ) : (
                <IconeCheck className="h-4 w-4" />
              )}
            </span>
            <div>
              <h2
                id="sec-atraso"
                className="font-display text-lg font-bold text-tinta"
              >
                {vencidas.length === 0
                  ? "Nada passou do prazo"
                  : `${vencidas.length} ${vencidas.length === 1 ? "passou" : "passaram"} do prazo`}
              </h2>
              <p className="text-xs text-tinta/70">
                {vencidas.length === 0
                  ? "Excelente! Nenhuma tarefa pendente está vencida."
                  : "Priorize estas entregas ou atualize o prazo combinado no detalhe."}
              </p>
            </div>
          </div>
          {vencidas.length > 0 && (
            <span className="rounded-full bg-trigo px-2.5 py-0.5 font-mono text-xs font-semibold text-tinta">
              {vencidas.length}
            </span>
          )}
        </div>

        {vencidas.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-linha bg-campo/40">
            {vencidas.map((t) => (
              <LinhaTarefa key={t.id} tarefa={t} aoAtualizar={atualizar} />
            ))}
          </div>
        )}
      </section>

      {/* 2. Em revisão */}
      {erroRevisoes ? (
        <p
          role="alert"
          className="rounded-xl border border-trigo bg-trigo/15 px-4 py-3 text-sm text-tinta"
        >
          Não foi possível consultar as revisões pendentes.
        </p>
      ) : (
        <Fila
          titulo="Em revisão"
          subtitulo="Entregues com commit confirmado e aguardando avaliação do revisor."
          icone={<IconeRevisoes className="h-4 w-4 text-ferro" />}
          fundoIcone="bg-ferro/15"
          itens={revisoesFiltradas}
          vazio="Nenhuma tarefa aguardando revisão agora."
          aoAtualizar={atualizar}
        />
      )}

      {/* 3. Próximos 7 dias */}
      <Fila
        titulo="Próximos 7 dias"
        subtitulo="Tarefas que vencem nesta janela de sete dias."
        icone={<IconeRelogio className="h-4 w-4 text-tinta" />}
        fundoIcone="bg-broto/25"
        itens={semana}
        vazio="A semana está livre — aproveite para adiantar tarefas futuras."
        aoAtualizar={atualizar}
      />

      {/* 4. Mais adiante */}
      <Fila
        titulo="Mais adiante"
        subtitulo="Demandas com prazo mais distante ou ainda sem data definida."
        icone={<IconeCalendario className="h-4 w-4 text-musgo" />}
        fundoIcone="bg-casca"
        itens={adiante}
        vazio="Sem tarefas na fila futura."
        aoAtualizar={atualizar}
      />
    </div>
  );
}

function CartaoKPI({
  rotulo,
  valor,
  detalhe,
  borda,
  fundoIcone,
  icone,
  interativo = false,
}: {
  rotulo: string;
  valor: string | number;
  detalhe: string;
  borda: string;
  fundoIcone: string;
  icone: ReactNode;
  interativo?: boolean;
}) {
  return (
    <div
      className={`cartao border-l-4 p-4 ${borda} ${
        interativo
          ? "transition-[transform,box-shadow] duration-micro ease-entrada hover:-translate-y-0.5 hover:shadow-cartao-hover"
          : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-tinta/70">{rotulo}</span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${fundoIcone}`}
        >
          {icone}
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-tinta">
        {valor}
      </p>
      <p className="mt-1 text-xs text-tinta/70">{detalhe}</p>
    </div>
  );
}

function Fila({
  titulo,
  subtitulo,
  icone,
  fundoIcone,
  itens,
  vazio,
  aoAtualizar,
}: {
  titulo: string;
  subtitulo: string;
  icone: ReactNode;
  fundoIcone: string;
  itens: Tarefa[];
  vazio: string;
  aoAtualizar: () => void;
}) {
  const id = `sec-${titulo.replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="cartao p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${fundoIcone}`}
          >
            {icone}
          </span>
          <div>
            <h2 id={id} className="font-display text-lg font-bold text-tinta">
              {titulo}
            </h2>
            <p className="text-xs text-tinta/70">{subtitulo}</p>
          </div>
        </div>
        <span className="rounded-full border border-linha bg-casca px-2.5 py-0.5 font-mono text-xs font-semibold text-tinta">
          {itens.length}
        </span>
      </div>

      {itens.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-linha bg-campo/60 px-3 py-3 text-sm text-tinta/70">
          {vazio}
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-linha bg-campo/40">
          {itens.map((t) => (
            <LinhaTarefa key={t.id} tarefa={t} aoAtualizar={aoAtualizar} />
          ))}
        </div>
      )}
    </section>
  );
}
