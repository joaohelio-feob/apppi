"use client";

import { useCallback, useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataCurta } from "@/lib/datas";
import { STATUS, responsaveisDe, type Escopo, type Tarefa } from "@/lib/types";
import ConfirmarAcao from "./ConfirmarAcao";
import { useToast } from "./ToastProvider";

/** Quem arquivou e quando, lido de `historico` — não existe coluna pra isso. */
type Arquivamento = { em: string; autor: string | null };

/**
 * Tarefas arquivadas. Baixa urgência, então linha e não cartão.
 *
 * Tarefa nunca é apagada: não existe policy de DELETE em `tarefas` e não vamos
 * criar. Apagar tiraria a linha de alguém da Trilha, que é a evidência
 * avaliada no PI. Arquivar é esconder das superfícies de trabalho, e é
 * reversível.
 */
export default function ListaArquivadas({
  escopo,
  aoRestaurar,
}: {
  /** O eixo de escopo do quadro continua valendo aqui: "arquivadas" é filtro
   *  de estado, e os dois se combinam em vez de um anular o outro. */
  escopo: Escopo;
  aoRestaurar?: () => void;
}) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [quandoArquivou, setQuandoArquivou] = useState<Map<number, Arquivamento>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<Tarefa | null>(null);
  const [restaurando, setRestaurando] = useState(false);

  const { avisar } = useToast();
  const supabase = criarClienteNavegador();

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("tarefas")
      .select("id, titulo, escopo, frente_id, status, prioridade, prazo, arquivada, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, cor, unidade)")
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

    // "Quando foi arquivada" e "quem arquivou" não são colunas de `tarefas`.
    // Vêm de `historico`, onde o trigger grava a ação 'arquivou' com autor e
    // instante. Uma tarefa pode ter ido e voltado várias vezes, então vale a
    // linha mais recente.
    if (lista.length > 0) {
      const { data: eventos } = await supabase
        .from("historico")
        .select("tarefa_id, em, membros:autor_id(nome)")
        .eq("acao", "arquivou")
        .in("tarefa_id", lista.map((t) => t.id))
        .order("em", { ascending: false });

      const mapa = new Map<number, Arquivamento>();
      ((eventos ?? []) as unknown as { tarefa_id: number; em: string; membros: { nome: string } | null }[])
        .forEach((e) => {
          if (!mapa.has(e.tarefa_id)) mapa.set(e.tarefa_id, { em: e.em, autor: e.membros?.nome ?? null });
        });
      setQuandoArquivou(mapa);
    }

    setCarregando(false);
  }, [escopo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar(); }, [carregar]);

  // Mesma publicação do quadro: arquivar numa aba some da outra sem F5.
  useEffect(() => {
    const canal = supabase
      .channel("arquivadas")
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [carregar]); // eslint-disable-line react-hooks/exhaustive-deps

  async function restaurar(t: Tarefa) {
    setRestaurando(true);
    const { error } = await supabase.from("tarefas").update({ arquivada: false }).eq("id", t.id);
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
    return <p className="mt-6 text-sm text-tinta/70">carregando arquivadas…</p>;
  }

  if (erro) {
    return (
      <p className="mt-6 border-l-2 border-trigo pl-3 text-sm">
        Não deu pra carregar as arquivadas: {erro}. Recarregue a página.
      </p>
    );
  }

  if (tarefas.length === 0) {
    return (
      <p className="mt-6 text-sm text-tinta/70">
        Nenhuma tarefa {escopo === "frente" ? "de frente" : "individual"} arquivada.
      </p>
    );
  }

  return (
    <>
      <div className="mt-6 border-t border-linha">
        {tarefas.map((t) => {
          const quando = quandoArquivou.get(t.id);
          const nomes = responsaveisDe(t).map((m) => m.nome);
          const status = STATUS.find((s) => s.id === t.status)?.nome ?? t.status;
          return (
            <div
              key={t.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-linha py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{t.titulo}</p>
                <p className="mt-0.5 text-xs text-tinta/70">
                  {nomes.length > 0 ? nomes.join(", ") : "sem dono"}
                  {t.frentes && <> · frente {t.frentes.nome}</>}
                  {" · estava em "}{status.toLowerCase()}
                  {t.prazo && <> · prazo <span className="font-mono">{t.prazo}</span></>}
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
                onClick={() => setConfirmando(t)}
                className="shrink-0 border border-linha px-3 py-1 text-xs transition-opacity duration-micro ease-entrada hover:bg-casca focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-musgo"
              >
                restaurar
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
              <strong className="font-semibold text-tinta">{confirmando.titulo}</strong> volta a
              aparecer no quadro, no calendário, na Semana e no painel da frente, no status em que
              estava ({(STATUS.find((s) => s.id === confirmando.status)?.nome ?? confirmando.status).toLowerCase()}).
              Dá para arquivar de novo a qualquer momento.
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
