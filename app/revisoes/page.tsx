"use client";

import { useAtualizacaoTarefas } from "@/lib/useAtualizacaoTarefas";
import AvisoErro from "@/components/ui/AvisoErro";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import GuiaDidatico from "@/components/ui/GuiaDidatico";
import Botao from "@/components/ui/Botao";
import { useCallback, useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import {
  RESULTADOS_REVISAO,
  iniciaisDe,
  responsaveisDe,
  type EstadoEntrega,
  type ResultadoRevisao,
  type Tarefa,
} from "@/lib/types";
import { useToast } from "@/components/ToastProvider";
import { dataCurta } from "@/lib/datas";
import {
  IconeCheck,
  IconeEntregas,
  IconeGit,
  IconeRelogio,
  IconeRetorno,
  IconeRevisoes,
} from "@/components/ui/Icones";

type ItemRevisao = Tarefa & { estado: EstadoEntrega };

export default function Revisoes() {
  const [erroCarga, setErroCarga] = useState(false);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [paraRevisar, setParaRevisar] = useState<ItemRevisao[]>([]);
  const [minhasEmRevisao, setMinhasEmRevisao] = useState<ItemRevisao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { avisar } = useToast();

  const supabase = criarClienteNavegador();

  const carregar = useCallback(async () => {
    const { data: sessao } = await supabase.auth.getUser();
    const meu = sessao.user?.id ?? null;
    setMeuId(meu);
    if (!meu) {
      setCarregando(false);
      return;
    }

    const [{ data: pr, error: erroPr }, { data: mr, error: erroMr }] =
      await Promise.all([
        supabase
          .from("tarefas")
          .select(
            "id, titulo, escopo, status, revisor_id, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, unidade)",
          )
          .eq("revisor_id", meu)
          .eq("status", "revisao")
          .eq("arquivada", false),
        supabase
          .from("tarefas")
          .select(
            "id, titulo, escopo, status, revisor_id, responsaveis:tarefa_responsaveis!inner(membro:membros(id, nome, papel)), frentes(id, nome, unidade)",
          )
          .eq("tarefa_responsaveis.membro_id", meu)
          .eq("status", "revisao")
          .not("revisor_id", "is", null)
          .eq("arquivada", false),
      ]);

    setErroCarga(!!(erroPr || erroMr));
    if (erroPr || erroMr) {
      setCarregando(false);
      return;
    }
    const todasTarefas = [...(pr ?? []), ...(mr ?? [])] as unknown as Tarefa[];
    const ids = Array.from(new Set(todasTarefas.map((t) => t.id)));

    const { data: estados, error: erroEstados } =
      ids.length > 0
        ? await supabase
            .from("tarefas_estado_entrega")
            .select("*")
            .in("tarefa_id", ids)
        : { data: [] as EstadoEntrega[], error: null };
    if (erroEstados) {
      setErroCarga(true);
      setCarregando(false);
      return;
    }
    const estadoPorTarefa = new Map(
      (estados ?? []).map((e) => [e.tarefa_id, e as EstadoEntrega]),
    );

    const juntar = (lista: Tarefa[]) =>
      lista
        .map((t) => ({ ...t, estado: estadoPorTarefa.get(t.id) }))
        .filter((t): t is ItemRevisao => !!t.estado && !t.estado.pendente_git);

    setParaRevisar(juntar((pr ?? []) as unknown as Tarefa[]));
    setMinhasEmRevisao(juntar((mr ?? []) as unknown as Tarefa[]));
    setCarregando(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    carregar();
  }, [carregar]);

  useAtualizacaoTarefas("revisoes", carregar);

  async function registrar(
    item: ItemRevisao,
    resultado: ResultadoRevisao,
    comentario: string | null,
  ) {
    if (!meuId || !item.estado.ultima_entrega_id) return false;
    const { error } = await supabase.from("revisoes").insert({
      tarefa_id: item.id,
      entrega_id: item.estado.ultima_entrega_id,
      revisor_id: meuId,
      resultado,
      comentario,
    });
    if (error) {
      avisar(
        "Não foi possível registrar a revisão. Seu comentário foi mantido.",
      );
      return false;
    }
    setParaRevisar((atual) => atual.filter((t) => t.id !== item.id));
    return true;
  }

  return (
    <div>
      <CabecalhoPagina
        categoria="Revisão entre pares"
        icone={<IconeRevisoes className="h-3.5 w-3.5 text-ferro" />}
        titulo="Revisões"
        descricao="Entregas só aparecem aqui depois que o commit (quando exigido) é confirmado por quem entregou."
      />

      <GuiaDidatico
        titulo="Como funcionam os 3 vereditos da revisão"
        resumo="Concluído, Observações ou Falta algo — ninguém revisa a própria tarefa."
        className="mb-6"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-musgo/40 bg-musgo/10 p-3">
            <p className="font-display text-xs font-bold text-tinta">
              ✓ Concluído
            </p>
            <p className="mt-1 text-xs text-tinta/70">
              Aprova na hora e move a tarefa para Concluída sem comentário.
            </p>
          </div>
          <div className="rounded-lg border border-linha bg-casca/70 p-3">
            <p className="font-display text-xs font-bold text-tinta">
              Observações
            </p>
            <p className="mt-1 text-xs text-tinta/70">
              Conclui a tarefa e fixa uma Nota do revisor para referência.
            </p>
          </div>
          <div className="rounded-lg border border-trigo bg-trigo/15 p-3">
            <p className="font-display text-xs font-bold text-tinta">
              ↩ Falta algo
            </p>
            <p className="mt-1 text-xs text-tinta/70">
              Devolve para Fazendo com aviso vermelho até haver reentrega.
            </p>
          </div>
        </div>
      </GuiaDidatico>

      {!carregando && !erroCarga && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="cartao border-l-4 border-l-ferro p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-tinta/70">
              <IconeRevisoes className="h-3.5 w-3.5 text-ferro" />
              Aguardando sua revisão
            </p>
            <p className="mt-1 font-display text-3xl font-extrabold text-tinta">
              {paraRevisar.length}
            </p>
          </div>
          <div className="cartao border-l-4 border-l-linha p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-tinta/70">
              <IconeRelogio className="h-3.5 w-3.5 text-musgo" />
              Suas tarefas em revisão
            </p>
            <p className="mt-1 font-display text-3xl font-extrabold text-tinta">
              {minhasEmRevisao.length}
            </p>
          </div>
        </div>
      )}

      {erroCarga && (
        <AvisoErro
          mensagem="Não foi possível carregar os dados. Tente novamente."
          aoTentar={carregar}
        />
      )}
      {carregando ? (
        <p className="mt-10 text-sm text-tinta/70">Carregando revisões…</p>
      ) : erroCarga ? null : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-tinta">
              <span>Para revisar</span>
              <span className="rounded-full border border-linha bg-casca px-2 py-0.5 font-mono text-xs text-tinta">
                {paraRevisar.length}
              </span>
            </h2>
            {paraRevisar.length === 0 ? (
              <div className="cartao p-6 text-center text-sm text-tinta/70">
                Nada esperando sua revisão agora.
              </div>
            ) : (
              <div className="space-y-4">
                {paraRevisar.map((t) => (
                  <CartaoParaRevisar
                    key={t.id}
                    item={t}
                    aoRevisar={registrar}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-tinta">
                <span>Minhas tarefas em revisão</span>
                <span className="rounded-full border border-linha bg-casca px-2 py-0.5 font-mono text-xs text-tinta">
                  {minhasEmRevisao.length}
                </span>
              </h2>
              <p className="text-xs text-tinta/70">
                Só leitura — aguardando quem foi designado revisor.
              </p>
            </div>
            {minhasEmRevisao.length === 0 ? (
              <div className="cartao p-6 text-center text-sm text-tinta/70">
                Nenhuma tarefa sua esperando revisor agora.
              </div>
            ) : (
              <div className="space-y-2.5">
                {minhasEmRevisao.map((t) => (
                  <div key={t.id} className="cartao p-4">
                    <p className="font-display text-sm font-bold text-tinta">
                      {t.titulo}
                    </p>
                    <p className="mt-1 font-mono text-xs text-tinta/70">
                      revisor: {t.estado.revisor_nome ?? "—"} · entregue em{" "}
                      {t.estado.entregue_em && dataCurta(t.estado.entregue_em)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function CartaoParaRevisar({
  item,
  aoRevisar,
}: {
  item: ItemRevisao;
  aoRevisar: (
    item: ItemRevisao,
    resultado: ResultadoRevisao,
    comentario: string | null,
  ) => Promise<boolean>;
}) {
  const [pedindoComentario, setPedindoComentario] =
    useState<ResultadoRevisao | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const nomeFrente = item.frentes?.nome;
  const nomeUnidade = item.frentes?.unidade;
  const responsaveis = responsaveisDe(item);

  async function confirmar(resultado: ResultadoRevisao) {
    if (resultado !== "concluido" && !comentario.trim()) return;
    if (enviando) return;
    setEnviando(true);
    const salvo = await aoRevisar(
      item,
      resultado,
      resultado === "concluido" ? null : comentario.trim(),
    );
    setEnviando(false);
    if (salvo) {
      setPedindoComentario(null);
      setComentario("");
    }
  }

  return (
    <article className="cartao border-l-4 border-l-ferro p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-tinta">
          {item.titulo}
        </h3>
        {nomeFrente && (
          <span className="rounded-full border border-linha bg-casca px-2.5 py-0.5 text-xs font-medium text-tinta">
            {nomeFrente}
            {nomeUnidade ? ` · ${nomeUnidade}` : ""}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-tinta/70">
        {responsaveis.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-linha bg-campo px-2.5 py-0.5 font-medium text-tinta">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-musgo font-mono text-xs text-campo">
              {iniciaisDe(responsaveis[0].nome).slice(0, 1)}
            </span>
            {responsaveis.map((m) => m.nome).join(", ")}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-casca px-2.5 py-0.5 font-mono">
          <IconeEntregas className="h-3 w-3 text-musgo" />
          {item.estado.arquivo_drive}
        </span>
        {item.estado.commit_nome && (
          <span className="inline-flex items-center gap-1 rounded-full bg-casca px-2.5 py-0.5 font-mono">
            <IconeGit className="h-3 w-3 text-musgo" />
            {item.estado.commit_nome}
          </span>
        )}
        {item.estado.entregue_em && (
          <span className="font-mono">
            entregue em {dataCurta(item.estado.entregue_em)}
          </span>
        )}
      </div>

      {item.estado.o_que_mudou && (
        <blockquote className="mt-3 rounded-xl border border-linha bg-campo/65 p-3 text-sm text-tinta">
          {item.estado.o_que_mudou}
        </blockquote>
      )}

      {pedindoComentario ? (
        <div className="mt-4 rounded-xl border border-linha bg-campo/70 p-3.5">
          <textarea
            autoFocus
            aria-label={
              pedindoComentario === "falta_algo"
                ? "O que falta para concluir"
                : "Observação da revisão"
            }
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder={
              pedindoComentario === "falta_algo"
                ? "Descreva claramente o que falta pra concluir…"
                : "Escreva sua observação de revisão…"
            }
            rows={2}
            className="campo"
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Botao
              variante="primario"
              onClick={() => confirmar(pedindoComentario)}
              disabled={enviando || !comentario.trim()}
            >
              {enviando
                ? "Enviando…"
                : `Confirmar ${RESULTADOS_REVISAO.find((r) => r.id === pedindoComentario)?.nome.toLowerCase()}`}
            </Botao>
            <Botao
              variante="discreto"
              disabled={enviando}
              onClick={() => {
                setPedindoComentario(null);
                setComentario("");
              }}
            >
              Cancelar
            </Botao>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-linha/80 pt-3.5">
          <button
            type="button"
            onClick={() => confirmar("concluido")}
            disabled={enviando}
            className="botao border-musgo bg-musgo text-campo hover:brightness-95"
          >
            <IconeCheck className="h-4 w-4" />
            Concluído
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={() => setPedindoComentario("observacao")}
            className="botao botao-secundario"
          >
            Observações
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={() => setPedindoComentario("falta_algo")}
            className="botao border-trigo bg-trigo/15 text-tinta hover:bg-trigo/30"
          >
            <IconeRetorno className="h-4 w-4" />
            Falta algo
          </button>
        </div>
      )}
    </article>
  );
}
