"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataLocalISO, diasEntre } from "@/lib/datas";
import {
  PAPEIS,
  UNIDADES_FRENTE,
  iniciaisDe,
  type Membro,
  type Tarefa,
} from "@/lib/types";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import { IconeUsuario } from "@/components/ui/Icones";

export default function PainelMembro() {
  const { id } = useParams<{ id: string }>();
  const [membro, setMembro] = useState<Membro | null>(null);
  const [individuais, setIndividuais] = useState<Tarefa[]>([]);
  const [deFrente, setDeFrente] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const supabase = criarClienteNavegador();
    const selecao =
      "id, status, inicio, concluido_em, prazo, tarefa_responsaveis!inner(membro_id), frentes(unidade)";

    Promise.all([
      supabase
        .from("membros")
        .select("id, nome, papel, criado_em")
        .eq("id", id)
        .single(),
      supabase
        .from("tarefas")
        .select(selecao)
        .eq("tarefa_responsaveis.membro_id", id)
        .eq("escopo", "individual"),
      supabase
        .from("tarefas")
        .select(selecao)
        .eq("tarefa_responsaveis.membro_id", id)
        .eq("escopo", "frente"),
    ]).then(([{ data: m }, { data: ti }, { data: tf }]) => {
      setMembro((m ?? null) as Membro | null);
      setIndividuais((ti ?? []) as unknown as Tarefa[]);
      setDeFrente((tf ?? []) as unknown as Tarefa[]);
      setCarregando(false);
    });
  }, [id]);

  if (carregando)
    return <p className="mt-10 text-sm text-tinta/70">Carregando painel…</p>;

  if (!membro) {
    return (
      <div className="cartao p-6">
        <p className="text-sm text-tinta/70">Integrante não encontrado.</p>
        <Link
          href="/equipe"
          className="mt-2 inline-block text-sm font-semibold text-musgo underline"
        >
          ← voltar pra Equipe
        </Link>
      </div>
    );
  }

  const papelNome =
    PAPEIS.find((p) => p.id === membro.papel)?.nome ?? membro.papel;

  return (
    <div>
      <CabecalhoPagina
        voltar={{ href: "/equipe", rotulo: "Equipe" }}
        categoria={`Painel individual · ${papelNome}`}
        icone={<IconeUsuario className="h-3.5 w-3.5 text-musgo" />}
        titulo={membro.nome}
        descricao={`O que ${membro.nome.split(" ")[0]} realizou sozinho, separado do trabalho conjunto da frente.`}
        acoes={
          <span
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-xl bg-musgo font-display text-lg font-extrabold text-campo shadow-cartao"
          >
            {iniciaisDe(membro.nome)}
          </span>
        }
      />

      <div className="space-y-8">
        <BlocoTarefas
          titulo="Trabalho individual"
          subtitulo="Tarefas com responsabilidade única."
          tarefas={individuais}
        />
        <BlocoTarefas
          titulo="Trabalho da frente"
          subtitulo="Tarefas conjuntas com todos da frente."
          tarefas={deFrente}
        />
      </div>
    </div>
  );
}

function BlocoTarefas({
  titulo,
  subtitulo,
  tarefas,
}: {
  titulo: string;
  subtitulo: string;
  tarefas: Tarefa[];
}) {
  const concluidas = tarefas.filter((t) => t.status === "concluida");

  const duracoes = concluidas
    .filter((t) => t.inicio && t.concluido_em)
    .map((t) => diasEntre(dataLocalISO(new Date(t.concluido_em!)), t.inicio!));
  const tempoMedio =
    duracoes.length > 0
      ? Math.round(
          (duracoes.reduce((a, b) => a + b, 0) / duracoes.length) * 10,
        ) / 10
      : null;

  const atrasadas = tarefas.filter((t) => {
    if (!t.prazo) return false;
    if (t.concluido_em) return dataLocalISO(new Date(t.concluido_em)) > t.prazo;
    return t.status !== "concluida" && t.prazo < dataLocalISO();
  });

  const porUnidade = concluidas.reduce<Record<string, number>>((acc, t) => {
    const nome = t.frentes?.unidade
      ? (UNIDADES_FRENTE.find((u) => u.id === t.frentes!.unidade)?.nome ??
        t.frentes.unidade)
      : "sem frente";
    acc[nome] = (acc[nome] ?? 0) + 1;
    return acc;
  }, {});
  const maiorUnidade = Math.max(1, ...Object.values(porUnidade));
  const taxa =
    tarefas.length > 0
      ? Math.round((concluidas.length / tarefas.length) * 100)
      : 0;

  return (
    <section className="cartao p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha pb-3">
        <div>
          <h2 className="font-display text-lg font-bold text-tinta">
            {titulo}
          </h2>
          <p className="text-xs text-tinta/70">{subtitulo}</p>
        </div>
        <span className="rounded-full border border-linha bg-casca px-3 py-1 font-mono text-xs font-semibold text-tinta">
          {taxa}% concluído
        </span>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-linha">
        <div
          className="h-full w-full origin-left rounded-full bg-musgo transition-transform duration-micro ease-entrada"
          style={{ transform: `scaleX(${taxa / 100})` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Estatistica
          rotulo="Concluídas"
          valor={concluidas.length}
          borda="border-l-musgo"
        />
        <Estatistica
          rotulo="Tempo médio"
          valor={tempoMedio !== null ? `${tempoMedio}d` : "—"}
          borda="border-l-ferro"
        />
        <Estatistica
          rotulo="Atrasaram"
          valor={atrasadas.length}
          borda={atrasadas.length > 0 ? "border-l-trigo" : "border-l-linha"}
        />
        <Estatistica
          rotulo="Total"
          valor={tarefas.length}
          borda="border-l-broto"
        />
      </div>

      <div className="mt-5">
        <h3 className="mb-2.5 font-display text-xs font-bold uppercase tracking-wide text-tinta/70">
          Distribuição por unidade de estudo
        </h3>
        {Object.keys(porUnidade).length === 0 ? (
          <p className="text-sm text-tinta/70">
            Ainda sem tarefas concluídas.
          </p>
        ) : (
          <div className="space-y-2.5">
            {Object.entries(porUnidade)
              .sort((a, b) => b[1] - a[1])
              .map(([nome, total]) => (
                <div key={nome} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 truncate text-sm font-medium text-tinta">
                    {nome}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-linha">
                    <div
                      className="h-full rounded-full bg-musgo"
                      style={{ width: `${(total / maiorUnidade) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-xs font-semibold text-tinta">
                    {total}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Estatistica({
  rotulo,
  valor,
  borda,
}: {
  rotulo: string;
  valor: string | number;
  borda: string;
}) {
  return (
    <div
      className={`rounded-xl border border-linha border-l-4 bg-campo/60 p-3.5 ${borda}`}
    >
      <p className="text-xs font-semibold text-tinta/70">{rotulo}</p>
      <p className="mt-1 font-display text-2xl font-extrabold text-tinta">
        {valor}
      </p>
    </div>
  );
}
