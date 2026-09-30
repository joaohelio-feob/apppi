"use client";

import { useAtualizacaoTarefas } from "@/lib/useAtualizacaoTarefas";

import AvisoErro from "@/components/ui/AvisoErro";

import { useCallback, useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import {
  RESULTADOS_REVISAO,
  responsaveisDe,
  type EstadoEntrega,
  type ResultadoRevisao,
  type Tarefa,
} from "@/lib/types";
import { useToast } from "@/components/ToastProvider";
import { dataCurta } from "@/lib/datas";

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
        // !inner aqui: precisa do embed pra filtrar por membro_id, mesmo
        // trazendo o mesmo formato (membro:membros(...)) que a query acima.
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

    // "pendente_git" ainda não é fila de revisão de verdade — o commit
    // precisa ser confirmado antes (decisão do Bloco A).
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
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        Revisões
      </h1>
      <p className="mt-2 max-w-prose text-sm text-tinta/70">
        Só aparece aqui depois que o commit (quando exigido) já foi confirmado —
        enquanto está pendente no Git, a tarefa espera na tela de quem entregou.
      </p>

      {erroCarga && (
        <AvisoErro
          mensagem="Não foi possível carregar os dados. Tente novamente."
          aoTentar={carregar}
        />
      )}
      {carregando ? (
        <p className="mt-10 text-sm text-tinta/70">carregando…</p>
      ) : erroCarga ? null : (
        <div className="mt-6 space-y-6">
          <section>
            <h2 className="mb-3 flex items-baseline gap-2 border-b border-linha pb-1 font-display text-lg font-semibold">
              Para revisar
              <span className="font-mono text-xs font-normal text-tinta/70">
                {paraRevisar.length}
              </span>
            </h2>
            {paraRevisar.length === 0 ? (
              <p className="text-sm text-tinta/70">
                Nada esperando sua revisão agora.
              </p>
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
            <h2 className="mb-3 flex items-baseline gap-2 border-b border-linha pb-1 font-display text-lg font-semibold">
              Minhas tarefas em revisão
              <span className="font-mono text-xs font-normal text-tinta/70">
                {minhasEmRevisao.length}
              </span>
            </h2>
            <p className="mb-3 text-xs text-tinta/70">
              Só leitura — aguardando quem foi designado revisor.
            </p>
            {minhasEmRevisao.length === 0 ? (
              <p className="text-sm text-tinta/70">
                Nenhuma tarefa sua esperando revisor agora.
              </p>
            ) : (
              <div className="space-y-2">
                {minhasEmRevisao.map((t) => (
                  <div key={t.id} className="border border-linha bg-casca p-3">
                    <p className="text-sm font-semibold">{t.titulo}</p>
                    <p className="mt-1 font-mono text-xs text-tinta/70">
                      revisando: {t.estado.revisor_nome ?? "—"} · entregue em{" "}
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

  async function confirmar(resultado: ResultadoRevisao) {
    if (resultado !== "concluido" && !comentario.trim()) return;
    setEnviando(true);
    if (enviando) return;
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
    <div className="border border-linha bg-casca p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display text-base font-semibold">{item.titulo}</h3>
        {nomeFrente && (
          <span className="border border-linha px-1.5 py-0.5 text-xs text-tinta/70">
            {nomeFrente}
            {nomeUnidade ? ` · ${nomeUnidade}` : ""}
          </span>
        )}
      </div>
      <p className="mt-1 font-mono text-xs text-tinta/70">
        responsável:{" "}
        {responsaveisDe(item)
          .map((m) => m.nome)
          .join(", ") || "sem responsável"}
      </p>
      <p className="mt-2 font-mono text-xs text-tinta/70">
        entregue em{" "}
        {item.estado.entregue_em && dataCurta(item.estado.entregue_em)}
        {" · "}arquivo:{" "}
        <span className="text-tinta">{item.estado.arquivo_drive}</span>
        {item.estado.commit_nome && (
          <>
            {" · "}commit:{" "}
            <span className="text-tinta">{item.estado.commit_nome}</span>
          </>
        )}
      </p>
      {item.estado.o_que_mudou && (
        <p className="mt-2 text-sm">{item.estado.o_que_mudou}</p>
      )}

      {pedindoComentario ? (
        <div className="mt-3">
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
                ? "O que falta pra concluir…"
                : "Sua observação…"
            }
            rows={2}
            className="w-full border border-linha bg-campo px-3 py-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => confirmar(pedindoComentario)}
              disabled={enviando || !comentario.trim()}
              className="bg-tinta px-3 py-1.5 text-xs text-campo hover:bg-musgo disabled:opacity-50"
            >
              {enviando
                ? "Enviando…"
                : `Confirmar ${RESULTADOS_REVISAO.find((r) => r.id === pedindoComentario)?.nome.toLowerCase()}`}
            </button>
            <button
              disabled={enviando}
              onClick={() => {
                setPedindoComentario(null);
                setComentario("");
              }}
              className="font-mono text-xs text-tinta/70 hover:text-tinta"
            >
              cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => confirmar("concluido")}
            disabled={enviando}
            className="bg-musgo px-3 py-1.5 text-xs text-campo hover:opacity-90 disabled:opacity-50"
          >
            Concluído
          </button>
          <button
            disabled={enviando}
            onClick={() => setPedindoComentario("observacao")}
            className="border border-linha px-3 py-1.5 text-xs text-tinta/70 hover:bg-campo"
          >
            Observações
          </button>
          <button
            disabled={enviando}
            onClick={() => setPedindoComentario("falta_algo")}
            className="border border-trigo px-3 py-1.5 text-xs text-tinta hover:bg-trigo/10"
          >
            Falta algo
          </button>
        </div>
      )}
    </div>
  );
}
