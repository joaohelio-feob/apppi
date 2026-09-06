"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataCurta } from "@/lib/datas";
import { alternarCriterio, lerCriterios } from "@/lib/criterios";
import { lerLocalEntrega } from "@/lib/links";
import {
  CLASSES_COR_FRENTE, CLASSES_COR_FRENTE_PREENCHIDA, ESCOPOS, PRIORIDADES,
  STATUS, UNIDADES_FRENTE, responsaveisDe,
  type EstadoEntrega, type Frente, type Membro, type Tarefa,
} from "@/lib/types";
import GerenciadorAnexos from "./GerenciadorAnexos";
import ModalEntrega from "./ModalEntrega";
import NotaRevisor from "./NotaRevisor";
import SeloIssue from "./SeloIssue";
import { useToast } from "./ToastProvider";

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Cabeçalho de bloco — a ficha técnica é dividida em seções nomeadas. */
function Bloco({
  titulo,
  children,
  id,
}: {
  titulo: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section aria-labelledby={id} className="mt-5 border-t border-linha pt-4">
      <h3 id={id} className="font-mono text-xs uppercase tracking-widest text-musgo">
        {titulo}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * Painel de detalhe/edição de uma tarefa — aberto ao clicar num CartaoTarefa.
 * Reúne o que antes só dava pra editar em /atribuicoes (responsável, frente,
 * status, prioridade, prazo) com o que só dava em /entregas (observações,
 * anexos, git), mais o campo de início, que não tinha lugar nenhum.
 *
 * Organizado em quatro blocos: ciclo de vida, critérios de aceite,
 * observações e entregáveis/evidências.
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

  // Rascunho local da descrição. Marcar uma checkbox NÃO grava no banco: todo
  // UPDATE em tarefas vira linha em historico (append-only, é a evidência
  // avaliada no PI), então um clique = uma linha de trilha inundaria
  // justamente o que a trilha existe pra provar. Uma escrita por sessão.
  const [rascunho, setRascunho] = useState(tarefa.descricao ?? "");
  const [salvandoDescricao, setSalvandoDescricao] = useState(false);

  const painel = useRef<HTMLDivElement>(null);
  const { avisar } = useToast();
  const supabase = criarClienteNavegador();

  const criterios = useMemo(() => lerCriterios(rascunho), [rascunho]);
  const feitos = criterios.filter((c) => c.feito).length;
  const descricaoSuja = rascunho !== (t.descricao ?? "");

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

  // Modal de verdade: trava o scroll do fundo e devolve o foco a quem abriu.
  useEffect(() => {
    const abriuDaqui = document.activeElement as HTMLElement | null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Foco inicial no próprio diálogo, não no primeiro campo: os campos daqui
    // salvam sozinhos (status, prazo, revisor...), então uma tecla batida sem
    // querer viraria escrita no banco e linha na trilha. O leitor de tela
    // anuncia o título pelo aria-labelledby.
    painel.current?.focus();

    return () => {
      document.body.style.overflow = overflowAnterior;
      abriuDaqui?.focus?.();
    };
  }, []);

  function tentarFechar() {
    if (descricaoSuja && !confirm("Os critérios de aceite têm alteração não salva. Fechar mesmo assim?")) {
      return;
    }
    aoFechar();
  }

  /** Esc fecha; Tab circula dentro do painel em vez de vazar pro fundo. */
  function aoTeclar(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      tentarFechar();
      return;
    }
    if (e.key !== "Tab" || !painel.current) return;

    const alvos = Array.from(painel.current.querySelectorAll<HTMLElement>(FOCAVEIS));
    if (alvos.length === 0) return;
    const primeiro = alvos[0];
    const ultimo = alvos[alvos.length - 1];
    const atual = document.activeElement;

    if (e.shiftKey && (atual === primeiro || atual === painel.current)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && atual === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  const responsaveis = responsaveisDe(t);
  const souResponsavel = responsaveis.some((m) => m.id === meuId);
  const local = lerLocalEntrega(t.local_entrega);
  const unidade = t.frentes?.unidade
    ? UNIDADES_FRENTE.find((u) => u.id === t.frentes!.unidade)?.nome ?? t.frentes.unidade
    : null;

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

  /** A única escrita da descrição — vale pelo textarea e por todas as checkboxes. */
  async function salvarDescricao() {
    const valor = rascunho.trim() ? rascunho : null;
    setSalvandoDescricao(true);
    const { error } = await supabase.from("tarefas").update({ descricao: valor }).eq("id", t.id);
    setSalvandoDescricao(false);
    if (error) {
      avisar("Não deu pra salvar os critérios. Tenta de novo.");
      return;
    }
    setT((atual) => ({ ...atual, descricao: valor }));
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-tinta/40 lg:items-center lg:p-4"
      onMouseDown={(e) => {
        // Só o clique que começa E termina no fundo fecha — arrastar uma
        // seleção de texto de dentro pra fora não deve fechar o painel.
        if (e.target === e.currentTarget) tentarFechar();
      }}
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalhe-titulo"
        tabIndex={-1}
        onKeyDown={aoTeclar}
        className="h-full w-full overflow-y-auto border-linha bg-campo p-4 focus:outline-none sm:p-6 lg:h-auto lg:max-h-[90vh] lg:max-w-2xl lg:border"
      >
        {/* ---------- 1. Cabeçalho e ciclo de vida ---------- */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-tinta/70">
              {ESCOPOS.find((e) => e.id === t.escopo)?.nome ?? t.escopo}
            </span>
            {t.frentes && (
              <span
                className={`flex max-w-[12rem] items-center gap-1 border px-1.5 py-0.5 font-mono text-xs uppercase tracking-wide ${
                  CLASSES_COR_FRENTE[t.frentes.cor ?? "ferro"]
                }`}
              >
                {t.escopo === "frente" && (
                  <i
                    aria-hidden="true"
                    className={`inline-block h-1.5 w-1.5 shrink-0 ${
                      CLASSES_COR_FRENTE_PREENCHIDA[t.frentes.cor ?? "ferro"]
                    }`}
                  />
                )}
                <span className="truncate">{t.frentes.nome}</span>
              </span>
            )}
            {unidade && (
              <span className="border border-linha px-1.5 py-0.5 font-mono text-xs uppercase text-tinta/70">
                {unidade}
              </span>
            )}
          </div>
          <button
            onClick={tentarFechar}
            aria-label="Fechar detalhes da tarefa"
            className="shrink-0 border border-linha px-2 py-1 font-mono text-xs uppercase text-tinta/70 transition duration-150 hover:bg-casca hover:text-tinta"
          >
            fechar
          </button>
        </div>

        <label className="mt-2 block">
          <span className="sr-only">Título da tarefa</span>
          <input
            id="detalhe-titulo"
            value={t.titulo}
            onChange={(e) => setT((atual) => ({ ...atual, titulo: e.target.value }))}
            onBlur={(e) => e.target.value.trim() && e.target.value !== tarefa.titulo && salvarCampo("titulo", e.target.value)}
            className="w-full border border-transparent bg-transparent font-display text-xl font-bold transition duration-150 hover:border-linha focus:border-linha focus:outline-none"
          />
        </label>

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
              className="mt-1 block w-full border border-linha bg-casca px-2 py-2 font-mono text-xs text-tinta"
            />
          </label>
          <label className="block font-mono text-xs uppercase text-tinta/70">
            Prazo
            <input
              type="date"
              value={t.prazo ?? ""}
              onChange={(e) => salvarCampo("prazo", e.target.value || null)}
              className="mt-1 block w-full border border-linha bg-casca px-2 py-2 font-mono text-xs text-tinta"
            />
          </label>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {t.escopo === "frente" ? (
            <p className="font-mono text-xs uppercase text-tinta/70">
              Responsáveis ({responsaveis.length})
              <span className="mt-1 block font-corpo text-sm normal-case text-tinta">
                {responsaveis.map((m) => m.nome).join(", ") || "sem responsável"}
              </span>
              <span className="mt-1 block font-corpo text-xs normal-case text-tinta/70">
                Tarefa de frente: quem responde é toda a frente, atribuída pelo banco.
              </span>
            </p>
          ) : (
            <>
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
                Frente (matéria)
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
              </label>
            </>
          )}

          <label className="block font-mono text-xs uppercase text-tinta/70">
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
        </div>

        {/* ---------- 2. Critérios de aceite (DoD) ---------- */}
        <Bloco id="bloco-criterios" titulo="Critérios de aceite">
          {criterios.length > 0 && (
            <>
              <p className="font-mono text-xs text-tinta/70">
                ✓ {feitos}/{criterios.length} concluídos
              </p>
              <ul className="mt-2 space-y-1">
                {criterios.map((c) => (
                  <li key={c.linha}>
                    <label className="flex cursor-pointer items-start gap-2 border border-linha bg-casca px-3 py-1.5 text-sm transition duration-150 hover:border-musgo">
                      <input
                        type="checkbox"
                        checked={c.feito}
                        onChange={(e) => setRascunho((atual) => alternarCriterio(atual, c.linha, e.target.checked))}
                        className="mt-0.5 h-4 w-4 shrink-0 appearance-none rounded-sm border border-linha bg-campo checked:border-musgo checked:bg-musgo"
                      />
                      <span className={`min-w-0 break-words ${c.feito ? "text-tinta/70 line-through" : ""}`}>
                        {c.texto || <em className="text-tinta/70">(critério sem texto)</em>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}

          <label className="mt-3 block font-mono text-xs uppercase text-tinta/70">
            Descrição
            <textarea
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              rows={criterios.length > 0 ? 3 : 4}
              placeholder={"Detalhes da tarefa.\nUma linha \"- [ ] ...\" vira critério de aceite marcável aqui em cima."}
              className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm normal-case text-tinta"
            />
          </label>

          {/* Uma escrita por sessão: as checkboxes e o textarea mexem no mesmo
              rascunho e este botão é o único caminho até o banco. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {descricaoSuja ? (
              <>
                <button
                  onClick={salvarDescricao}
                  disabled={salvandoDescricao}
                  className="bg-tinta px-3 py-1.5 font-mono text-xs uppercase text-campo transition duration-150 hover:bg-musgo disabled:opacity-50"
                >
                  {salvandoDescricao ? "salvando…" : "Salvar critérios"}
                </button>
                <button
                  onClick={() => setRascunho(t.descricao ?? "")}
                  className="font-mono text-xs uppercase text-tinta/70 underline underline-offset-4 hover:text-tinta"
                >
                  descartar
                </button>
                <span className="font-mono text-xs text-trigo">alterações não salvas</span>
              </>
            ) : (
              <span className="font-mono text-xs text-tinta/70">tudo salvo</span>
            )}
          </div>
        </Bloco>

        {/* ---------- 3. Observações ---------- */}
        <Bloco id="bloco-observacoes" titulo="Observações">
          <textarea
            value={t.observacoes ?? ""}
            onChange={(e) => setT((atual) => ({ ...atual, observacoes: e.target.value }))}
            onBlur={(e) => e.target.value !== (tarefa.observacoes ?? "") && salvarCampo("observacoes", e.target.value || null)}
            rows={3}
            placeholder="Notas de quem entregou…"
            className="w-full border border-linha bg-casca px-3 py-2 text-sm"
          />
        </Bloco>

        {/* ---------- 4. Entregáveis e evidências ---------- */}
        <Bloco id="bloco-entregaveis" titulo="Entregáveis e evidências">
          <label className="block font-mono text-xs uppercase text-tinta/70">
            Local de entrega
            <input
              value={t.local_entrega ?? ""}
              onChange={(e) => setT((atual) => ({ ...atual, local_entrega: e.target.value }))}
              onBlur={(e) => e.target.value !== (tarefa.local_entrega ?? "") && salvarCampo("local_entrega", e.target.value || null)}
              placeholder="Link do Drive, Forms, PR do GitHub… (opcional)"
              className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm normal-case text-tinta"
            />
          </label>
          {local && (
            <p className="mt-1 font-mono text-xs text-tinta/70">
              {local.tipo === "link" ? (
                <a
                  href={local.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={local.titulo}
                  className="underline underline-offset-4 hover:text-musgo"
                >
                  abrir {local.rotulo}
                </a>
              ) : (
                // Não vira link: o campo é texto livre e `new URL` aceita
                // javascript:/data: numa boa. Só http e https viram href.
                <span title={local.titulo}>
                  não é um link http(s) — fica como anotação
                </span>
              )}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="font-mono text-xs uppercase text-tinta/70">Entrega</span>
            {souResponsavel && (
              <button
                onClick={() => setEntregaAberta(true)}
                className="bg-tinta px-3 py-1.5 font-mono text-xs uppercase text-campo transition duration-150 hover:bg-musgo"
              >
                Entregar
              </button>
            )}
          </div>

          {/* As duas perguntas de git, lado a lado. Elas respondem coisas
              diferentes e podem divergir sem que nenhuma esteja errada:
              "falta commitar?" é calculado a partir da última entrega,
              "alguém marcou que subiu?" é declaração manual de quem
              trabalhou. Nenhuma corrige a outra — por isso as duas aparecem
              aqui, com o significado escrito, e nenhuma delas no cartão. */}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className={`border px-3 py-2 ${estado?.pendente_git ? "border-trigo bg-trigo/10" : "border-linha bg-casca"}`}>
              <p className="text-xs uppercase tracking-wide text-tinta/70">Falta commitar?</p>
              <p className="mt-1 text-sm font-semibold">
                {estado?.pendente_git ? "Sim — a entrega pede commit e ele ainda não foi confirmado" : "Não"}
              </p>
              <p className="mt-1 text-xs text-tinta/70">
                Calculado a partir da última entrega, não editável.
              </p>
              {estado?.pendente_git && estado.commit_nome && (
                <p className="mt-1 break-words font-mono text-xs text-tinta/70">
                  commit: <span className="text-tinta">{estado.commit_nome}</span>
                </p>
              )}
              {estado?.pendente_git && souResponsavel && (
                <button
                  onClick={confirmarCommit}
                  disabled={confirmandoCommit}
                  className="mt-2 text-xs underline underline-offset-4 hover:text-musgo disabled:opacity-50"
                >
                  {confirmandoCommit ? "confirmando…" : "Confirmar commit"}
                </button>
              )}
            </div>

            <label className="block cursor-pointer border border-linha bg-casca px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-tinta/70">Alguém marcou que subiu?</p>
              <span className="mt-1 flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={t.subiu_git}
                  onChange={(e) => salvarCampo("subiu_git", e.target.checked)}
                />
                {t.subiu_git ? "Sim, marcado pela equipe" : "Ainda não marcaram"}
              </span>
              <span className="mt-1 block text-xs text-tinta/70">
                Marcação manual da equipe, independente do cálculo ao lado.
              </span>
            </label>
          </div>

          {estado?.ultima_entrega_id ? (
            <div className="mt-2 text-sm text-tinta/70">
              <p className="font-mono text-xs text-tinta/70">
                Entregue por <span className="text-tinta">{estado.entrega_autor_nome}</span> em{" "}
                {estado.entregue_em && dataCurta(estado.entregue_em)} · arquivo:{" "}
                <span className="break-words text-tinta">{estado.arquivo_drive}</span>
              </p>
              {estado.o_que_mudou && <p className="mt-1">{estado.o_que_mudou}</p>}
            </div>
          ) : (
            <p className="mt-2 text-sm text-tinta/70">Ainda não foi entregue.</p>
          )}

          <NotaRevisor tarefaId={t.id} entregueEm={estado?.entregue_em ?? null} />

          <div className="mt-4">
            <label className="block font-mono text-xs uppercase text-tinta/70">
              Nº da issue no GitHub
              <span className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={t.issue_numero ?? ""}
                  onChange={(e) => salvarCampo("issue_numero", e.target.value ? Number(e.target.value) : null)}
                  className="block w-full border border-linha bg-casca px-2 py-2 font-mono text-xs normal-case text-tinta"
                />
                {t.issue_numero && (
                  <span className="shrink-0 font-mono text-xs normal-case">
                    <SeloIssue numero={t.issue_numero} />
                  </span>
                )}
              </span>
            </label>
          </div>

          <div className="mt-4">
            <GerenciadorAnexos tarefaId={t.id} />
          </div>
        </Bloco>

        <div className="mt-5 border-t border-linha pt-3">
          <button
            onClick={arquivar}
            disabled={arquivando}
            className="font-mono text-xs text-tinta/70 transition duration-150 hover:text-trigo disabled:opacity-50"
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
