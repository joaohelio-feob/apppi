"use client";

import { useAtualizacaoTarefas } from "@/lib/useAtualizacaoTarefas";
import { useCallback, useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataCurta } from "@/lib/datas";
import { STATUS, responsaveisDe, type Escopo, type Tarefa } from "@/lib/types";
import ConfirmarAcao from "./ConfirmarAcao";
import { useToast } from "./ToastProvider";
import { IconeRetorno } from "./ui/Icones";

/** Quem arquivou e quando, lido de `historico` — não existe coluna pra isso. */
type Arquivamento = { em: string; autor: string | null };

export default function ListaArquivadas({
  escopo,
  aoRestaurar,
  filtrarTarefa,
}: {
  escopo: Escopo;
  aoRestaurar?: () => void;
  filtrarTarefa?: (tarefa: Tarefa) => boolean;
}) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [quandoArquivou, setQuandoArquivou] = useState<
    Map<number, Arquivamento>
  >(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<Tarefa | null>(null);
  const [restaurando, setRestaurando] = useState(false);

  const { avisar } = useToast();
  const supabase = criarClienteNavegador();

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("tarefas")
      .select(
        "id, titulo, escopo, frente_id, status, prioridade, prazo, arquivada, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, cor, unidade)",
      )
      .eq("arquivada", true)
      .eq("escopo", escopo)
      .order("atualizado_em", { ascending: false });

    if (error) {
      setErro(error.message);
      setCarregando(false);
      return;
    }

    const lista = (data ?? []) as unknown as Tarefa[];
    setTarefas(lista);
    setErro(null);

    if (lista.length > 0) {
      const { data: eventos } = await supabase
        .from("historico")
        .select("tarefa_id, em, membros:autor_id(nome)")
        .eq("acao", "arquivou")
        .in(
          "tarefa_id",
          lista.map((t) => t.id),
        )
        .order("em", { ascending: false });

      const mapa = new Map<number, Arquivamento>();
      (
        (eventos ?? []) as unknown as {
          tarefa_id: number;
          em: string;
          membros: { nome: string } | null;
        }[]
      ).forEach((e) => {
        if (!mapa.has(e.tarefa_id))
          mapa.set(e.tarefa_id, { em: e.em, autor: e.membros?.nome ?? null });
      });
      setQuandoArquivou(mapa);
    }

    setCarregando(false);
  }, [escopo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    carregar();
  }, [carregar]);

  useAtualizacaoTarefas("arquivadas", carregar);

  async function restaurar(t: Tarefa) {
    setRestaurando(true);
    const { error } = await supabase
      .from("tarefas")
      .update({ arquivada: false })
      .eq("id", t.id);
    setRestaurando(false);
    setConfirmando(null);
    if (error) {
      avisar("Não deu pra restaurar. Tenta de novo.");
      return;
    }
    setTarefas((atual) => atual.filter((x) => x.id !== t.id));
    aoRestaurar?.();
  }

  if (carregando) {
    return <p className="mt-6 text-sm text-tinta/70">Carregando arquivadas…</p>;
  }

  if (erro) {
    return (
      <p className="mt-6 rounded-xl border border-trigo bg-trigo/15 px-4 py-3 text-sm text-tinta">
        Não deu pra carregar as arquivadas: {erro}. Recarregue a página.
      </p>
    );
  }

  const visiveis = filtrarTarefa ? tarefas.filter(filtrarTarefa) : tarefas;
  if (visiveis.length === 0) {
    return (
      <div className="cartao mt-6 p-6 text-center text-sm text-tinta/70">
        Nenhuma tarefa {escopo === "frente" ? "de frente" : "individual"}{" "}
        arquivada com estes filtros.
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 space-y-2.5">
        {visiveis.map((t) => {
          const quando = quandoArquivou.get(t.id);
          const nomes = responsaveisDe(t).map((m) => m.nome);
          const status =
            STATUS.find((s) => s.id === t.status)?.nome ?? t.status;
          return (
            <div
              key={t.id}
              className="cartao flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-tinta">
                  {t.titulo}
                </p>
                <p className="mt-0.5 text-xs text-tinta/70">
                  {nomes.length > 0 ? nomes.join(", ") : "sem dono"}
                  {t.frentes && <> · frente {t.frentes.nome}</>}
                  {" · estava em "}
                  {status.toLowerCase()}
                  {t.prazo && (
                    <>
                      {" "}
                      · prazo <span className="font-mono">{t.prazo}</span>
                    </>
                  )}
                  {quando && (
                    <>
                      {" · arquivada em "}
                      <span className="font-mono">{dataCurta(quando.em)}</span>
                      {quando.autor && <> por {quando.autor}</>}
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmando(t)}
                className="botao botao-secundario min-h-8 shrink-0 px-3 py-1 text-xs"
              >
                <IconeRetorno className="h-3.5 w-3.5" />
                Restaurar
              </button>
            </div>
          );
        })}
      </div>

      {confirmando && (
        <ConfirmarAcao
          titulo="Restaurar esta tarefa?"
          descricao={
            <>
              <strong className="font-semibold text-tinta">
                {confirmando.titulo}
              </strong>{" "}
              volta a aparecer no quadro, no calendário, na Semana e no painel
              da frente, no status em que estava (
              {(
                STATUS.find((s) => s.id === confirmando.status)?.nome ??
                confirmando.status
              ).toLowerCase()}
              ). Dá para arquivar de novo a qualquer momento.
            </>
          }
          rotuloConfirmar="Restaurar"
          executando={restaurando}
          aoConfirmar={() => restaurar(confirmando)}
          aoCancelar={() => setConfirmando(null)}
        />
      )}
    </>
  );
}
