"use client";

import { useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import {
  CLASSES_COR_FRENTE, PRIORIDADES, STATUS, UNIDADES_FRENTE, responsaveisDe,
  type EstadoEntrega, type Frente, type Membro, type Tarefa,
} from "@/lib/types";
import GerenciadorAnexos from "./GerenciadorAnexos";
import ModalEntrega from "./ModalEntrega";
import NotaRevisor from "./NotaRevisor";
import SeloIssue from "./SeloIssue";
import { useToast } from "./ToastProvider";

/**
 * Painel de detalhe/edição de uma tarefa — aberto ao clicar num CartaoTarefa.
 * Reúne o que antes só dava pra editar em /atribuicoes (responsável, frente,
 * status, prioridade, prazo) com o que só dava em /entregas (observações,
 * anexos, git), mais o campo de início, que não tinha lugar nenhum.
 */
export default function DetalheTarefa({
  tarefa,
  aoFechar,
  aoAtualizar,
  membrosIniciais,
  frentesIniciais,
}: {
  tarefa: Tarefa;
  aoFechar: () => void;
  aoAtualizar?: () => void;
  /** Se a página que abriu o painel já tem essas listas carregadas (ex.: Quadro),
   *  passa aqui pra não duplicar a consulta — só id/nome são usados nos selects. */
  membrosIniciais?: Membro[];
  frentesIniciais?: Frente[];
}) {
  const [t, setT] = useState(tarefa);
  const [membros, setMembros] = useState<Membro[]>(membrosIniciais ?? []);
  const [frentes, setFrentes] = useState<Frente[]>(frentesIniciais ?? []);
  const [arquivando, setArquivando] = useState(false);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoEntrega | null>(null);
  const [entregaAberta, setEntregaAberta] = useState(false);
  const [confirmandoCommit, setConfirmandoCommit] = useState(false);
  const { avisar } = useToast();
  const supabase = criarClienteNavegador();

  async function carregarEstadoEntrega() {
    const { data } = await supabase
      .from("tarefas_estado_entrega")
      .select("*")
      .eq("tarefa_id", t.id)
      .maybeSingle();
    setEstado((data ?? null) as EstadoEntrega | null);
  }

  useEffect(() => {
    if (!(membrosIniciais && frentesIniciais)) {
      Promise.all([
        supabase.from("membros").select("id, nome, papel, frente_id").order("nome"),
        supabase.from("frentes").select("id, nome, cor, unidade").order("nome"),
      ]).then(([m, f]) => {
        setMembros((m.data ?? []) as Membro[]);
        setFrentes((f.data ?? []) as unknown as Frente[]);
      });
    }
    supabase.auth.getUser().then(({ data }) => setMeuId(data.user?.id ?? null));
    carregarEstadoEntrega();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const souResponsavel = responsaveisDe(t).some((m) => m.id === meuId);

  async function confirmarCommit() {
    setConfirmandoCommit(true);
    const { error } = await supabase
      .from("tarefas")
      .update({ commit_confirmado_em: new Date().toISOString() })
      .eq("id", t.id);
    setConfirmandoCommit(false);
    if (error) {
      avisar("Não deu pra confirmar o commit. Tenta de novo.");
      return;
    }
    carregarEstadoEntrega();
    aoAtualizar?.();
  }

  async function salvarCampo(campo: keyof Tarefa, valor: string | number | boolean | null) {
    const anterior = t[campo];
    setT((atual) => ({ ...atual, [campo]: valor }));
    const { error } = await supabase.from("tarefas").update({ [campo]: valor }).eq("id", t.id);
    if (error) {
      setT((atual) => ({ ...atual, [campo]: anterior }));
      avisar("Não deu pra salvar. Tenta de novo.");
      return;
    }
    aoAtualizar?.();
  }

  async function salvarFrente(frenteId: string) {
    const valor = frenteId ? Number(frenteId) : null;
    const frenteEncontrada = frentes.find((f) => f.id === valor) ?? null;
    const anterior = { frente_id: t.frente_id, frentes: t.frentes };
    setT((atual) => ({ ...atual, frente_id: valor, frentes: frenteEncontrada }));
    const { error } = await supabase.from("tarefas").update({ frente_id: valor }).eq("id", t.id);
    if (error) {
      setT((atual) => ({ ...atual, ...anterior }));
      avisar("Não deu pra mudar a frente. Tenta de novo.");
      return;
    }
    aoAtualizar?.();
  }

  async function salvarResponsavel(membroId: string) {
    const atual = responsaveisDe(t)[0];
    const membro = membroId ? membros.find((m) => m.id === membroId) ?? null : null;
    setT((estado) => ({ ...estado, responsaveis: membro ? [{ membro }] : [] }));

    const resultado = !membroId
      ? atual
        ? await supabase.from("tarefa_responsaveis").delete().eq("tarefa_id", t.id).eq("membro_id", atual.id)
        : { error: null }
      : atual
      ? await supabase.from("tarefa_responsaveis").update({ membro_id: membroId }).eq("tarefa_id", t.id).eq("membro_id", atual.id)
      : await supabase.from("tarefa_responsaveis").insert({ tarefa_id: t.id, membro_id: membroId });

    if (resultado.error) {
      setT((estado) => ({ ...estado, responsaveis: atual ? [{ membro: atual }] : [] }));
      avisar("Não deu pra mudar o responsável. Tenta de novo.");
      return;
    }
    aoAtualizar?.();
  }

  async function arquivar() {
    if (!confirm("Arquivar esta tarefa? Ela some dos quadros, mas o histórico continua.")) return;
    setArquivando(true);
    const { error } = await supabase.from("tarefas").update({ arquivada: true }).eq("id", t.id);
    setArquivando(false);
    if (error) {
      avisar("Não deu pra arquivar. Tenta de novo.");
      return;
    }
    aoAtualizar?.();
    aoFechar();
  }

  const responsaveis = responsaveisDe(t);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-linha bg-campo p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-widest text-musgo">
            {t.escopo === "frente" ? (
              <span className={`border px-1.5 py-0.5 ${CLASSES_COR_FRENTE[t.frentes?.cor ?? "ferro"]}`}>
                {t.frentes?.nome ?? "frente"}
              </span>
            ) : (
              "Tarefa individual"
            )}
          </p>
          <button onClick={aoFechar} className="font-mono text-xs text-tinta/70 hover:text-tinta">
            fechar
          </button>
        </div>

        <input
          value={t.titulo}
          onChange={(e) => setT((atual) => ({ ...atual, titulo: e.target.value }))}
          onBlur={(e) => e.target.value.trim() && e.target.value !== tarefa.titulo && salvarCampo("titulo", e.target.value)}
          className="mt-1 w-full border border-transparent bg-transparent font-display text-xl font-bold hover:border-linha focus:border-linha focus:outline-none"
        />

        <textarea
          value={t.descricao ?? ""}
          onChange={(e) => setT((atual) => ({ ...atual, descricao: e.target.value }))}
          onBlur={(e) => e.target.value !== (tarefa.descricao ?? "") && salvarCampo("descricao", e.target.value || null)}
          rows={2}
          placeholder="Detalhes, critérios de aceite…"
          className="mt-2 w-full border border-linha bg-casca px-3 py-2 text-sm"
        />

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="block font-mono text-xs uppercase text-tinta/70">
            Status
            <select
              value={t.status}
              onChange={(e) => salvarCampo("status", e.target.value)}
              className="mt-1 block w-full border border-linha bg-casca px-2 py-2 font-mono text-xs uppercase"
            >
              {STATUS.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </label>
          <label className="block font-mono text-xs uppercase text-tinta/70">
            Prioridade
            <select
              value={t.prioridade}
              onChange={(e) => salvarCampo("prioridade", e.target.value)}
              className="mt-1 block w-full border border-linha bg-casca px-2 py-2 font-mono text-xs uppercase"
            >
              {PRIORIDADES.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </label>
          <label className="block font-mono text-xs uppercase text-tinta/70">
            Início
            <input
              type="date"
              value={t.inicio ?? ""}
              onChange={(e) => salvarCampo("inicio", e.target.value || null)}
              className="mt-1 block w-full border border-linha bg-casca px-2 py-2 font-corpo text-sm text-tinta"
            />
          </label>
          <label className="block font-mono text-xs uppercase text-tinta/70">
            Prazo
            <input
              type="date"
              value={t.prazo ?? ""}
              onChange={(e) => salvarCampo("prazo", e.target.value || null)}
              className="mt-1 block w-full border border-linha bg-casca px-2 py-2 font-corpo text-sm text-tinta"
            />
          </label>
        </div>

        <div className="mt-2">
          {t.escopo === "frente" ? (
            <p className="font-mono text-xs uppercase text-tinta/70">
              Responsáveis
              <span className="mt-1 block font-corpo text-sm normal-case text-tinta">
                {responsaveis.map((m) => m.nome).join(", ") || "sem responsável"}
              </span>
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <label className="block font-mono text-xs uppercase text-tinta/70">
                Responsável
                <select
                  value={responsaveis[0]?.id ?? ""}
                  onChange={(e) => salvarResponsavel(e.target.value)}
                  className="mt-1 block w-full border border-linha bg-casca px-2 py-2 font-corpo text-sm normal-case text-tinta"
                >
                  <option value="">sem dono</option>
                  {membros.map((m) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </label>
              <label className="block font-mono text-xs uppercase text-tinta/70">
                Frente
                <select
                  value={t.frente_id ?? ""}
                  onChange={(e) => salvarFrente(e.target.value)}
                  className="mt-1 block w-full border border-linha bg-casca px-2 py-2 font-corpo text-sm normal-case text-tinta"
                >
                  <option value="">sem frente</option>
                  {frentes.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
                {t.frentes?.unidade && (
                  <span className="mt-1 block font-corpo text-xs normal-case text-tinta/70">
                    {UNIDADES_FRENTE.find((u) => u.id === t.frentes!.unidade)?.nome ?? t.frentes.unidade}
                  </span>
                )}
              </label>
            </div>
          )}
        </div>

        <label className="mt-2 block font-mono text-xs uppercase text-tinta/70">
          Revisor (opcional)
          <select
            value={t.revisor_id ?? ""}
            onChange={(e) => salvarCampo("revisor_id", e.target.value || null)}
            className="mt-1 block w-full border border-linha bg-casca px-2 py-2 font-corpo text-sm normal-case text-tinta"
          >
            <option value="">Sem revisor</option>
            {membros
              .filter((m) => !responsaveis.some((r) => r.id === m.id))
              .map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
          </select>
          <span className="mt-1 block font-corpo text-xs normal-case text-tinta/70">
            Sem revisor, a tarefa conclui direto quando for entregue.
          </span>
        </label>

        <input
          value={t.local_entrega ?? ""}
          onChange={(e) => setT((atual) => ({ ...atual, local_entrega: e.target.value }))}
          onBlur={(e) => e.target.value !== (tarefa.local_entrega ?? "") && salvarCampo("local_entrega", e.target.value || null)}
          placeholder="Local de entrega: link do Drive, Forms, GitHub… (opcional)"
          className="mt-4 w-full border border-linha bg-casca px-3 py-2 text-sm"
        />

        <div className="mt-2 flex items-center gap-2">
          <label className="flex-1 font-mono text-xs uppercase text-tinta/70">
            Nº da issue no GitHub
            <input
              type="number"
              min={1}
              value={t.issue_numero ?? ""}
              onChange={(e) => salvarCampo("issue_numero", e.target.value ? Number(e.target.value) : null)}
              className="mt-1 block w-full border border-linha bg-casca px-2 py-2 font-corpo text-sm normal-case text-tinta"
            />
          </label>
          {t.issue_numero && (
            <span className="pt-5">
              <SeloIssue numero={t.issue_numero} />
            </span>
          )}
        </div>

        <label className="mt-4 flex items-center gap-2 border border-linha bg-casca px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={t.subiu_git}
            onChange={(e) => salvarCampo("subiu_git", e.target.checked)}
          />
          Já subiu no Git
        </label>

        <div className="mt-5 border-t border-linha pt-4">
          <div className="flex items-center justify-between">
            <label className="font-mono text-xs uppercase text-tinta/70">Entrega</label>
            {souResponsavel && (
              <button
                onClick={() => setEntregaAberta(true)}
                className="bg-tinta px-3 py-1.5 font-mono text-xs uppercase text-campo hover:bg-musgo"
              >
                Entregar
              </button>
            )}
          </div>

          {estado?.pendente_git && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border border-trigo bg-trigo/10 px-3 py-2">
              <span className="bg-trigo px-2 py-0.5 font-mono text-xs uppercase text-tinta">
                Pendente no Git
              </span>
              {estado.commit_nome && (
                <span className="text-sm">
                  commit: <strong className="font-semibold">{estado.commit_nome}</strong>
                </span>
              )}
              {souResponsavel && (
                <button
                  onClick={confirmarCommit}
                  disabled={confirmandoCommit}
                  className="ml-auto font-mono text-xs uppercase underline underline-offset-4 hover:text-musgo disabled:opacity-50"
                >
                  {confirmandoCommit ? "confirmando…" : "Confirmar commit"}
                </button>
              )}
            </div>
          )}

          {estado?.ultima_entrega_id && (
            <div className="mt-2 text-sm text-tinta/70">
              <p className="font-mono text-xs text-tinta/70">
                Entregue por <span className="text-tinta">{estado.entrega_autor_nome}</span> em{" "}
                {estado.entregue_em && new Date(estado.entregue_em).toLocaleDateString("pt-BR")} · arquivo:{" "}
                <span className="text-tinta">{estado.arquivo_drive}</span>
              </p>
              {estado.o_que_mudou && <p className="mt-1">{estado.o_que_mudou}</p>}
            </div>
          )}

          {!estado?.ultima_entrega_id && (
            <p className="mt-2 text-sm text-tinta/70">Ainda não foi entregue.</p>
          )}

          <NotaRevisor tarefaId={t.id} entregueEm={estado?.entregue_em ?? null} />
        </div>

        <div className="mt-4">
          <label className="block font-mono text-xs uppercase text-tinta/70">Observações</label>
          <textarea
            value={t.observacoes ?? ""}
            onChange={(e) => setT((atual) => ({ ...atual, observacoes: e.target.value }))}
            onBlur={(e) => e.target.value !== (tarefa.observacoes ?? "") && salvarCampo("observacoes", e.target.value || null)}
            rows={3}
            placeholder="Notas de quem entregou…"
            className="mt-1 w-full border border-linha bg-casca px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-5">
          <GerenciadorAnexos tarefaId={t.id} />
        </div>

        <div className="mt-5 border-t border-linha pt-3">
          <button
            onClick={arquivar}
            disabled={arquivando}
            className="font-mono text-xs text-tinta/70 hover:text-trigo disabled:opacity-50"
          >
            {arquivando ? "arquivando…" : "arquivar tarefa"}
          </button>
        </div>
      </div>

      {entregaAberta && (
        <ModalEntrega
          tarefaId={t.id}
          aoFechar={() => setEntregaAberta(false)}
          aoEntregar={() => {
            carregarEstadoEntrega();
            aoAtualizar?.();
          }}
        />
      )}
    </div>
  );
}
