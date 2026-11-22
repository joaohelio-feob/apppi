"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataCurta } from "@/lib/datas";
import { alternarCriterio, lerCriterios } from "@/lib/criterios";
import { lerLocalEntrega } from "@/lib/links";
import {
  CLASSES_COR_FRENTE,
  CLASSES_COR_FRENTE_PREENCHIDA,
  ESCOPOS,
  PRIORIDADES,
  STATUS,
  UNIDADES_FRENTE,
  iniciaisDe,
  responsaveisDe,
  type EstadoEntrega,
  type Frente,
  type Membro,
  type Tarefa,
} from "@/lib/types";
import AtividadeTarefa from "./tarefa/AtividadeTarefa";
import ConfirmarAcao from "./ConfirmarAcao";
import GerenciadorAnexos from "./GerenciadorAnexos";
import ModalEntrega from "./ModalEntrega";
import NotaRevisor from "./NotaRevisor";
import SeloIssue from "./SeloIssue";
import Dialogo from "./ui/Dialogo";
import AvisoErro from "./ui/AvisoErro";
import FluxoTarefa from "./ui/FluxoTarefa";
import {
  IconeArquivo,
  IconeCheck,
  IconeDica,
  IconeEntregas,
  IconeFechar,
  IconeGit,
  IconeUsuario,
} from "./ui/Icones";

type PropriedadesDetalhe = {
  tarefa: Tarefa;
  aoFechar: () => void;
  aoAtualizar?: () => void;
  membrosIniciais?: Membro[];
  frentesIniciais?: Frente[];
};

// As filas carregam projeções menores. Nunca editar a partir de campos ausentes.
export default function DetalheTarefa(props: PropriedadesDetalhe) {
  const [origem] = useState(() =>
    typeof document !== "undefined"
      ? (document.activeElement as HTMLElement | null)
      : null,
  );
  useEffect(
    () => () => {
      queueMicrotask(() => {
        if (origem?.isConnected) origem.focus();
        else document.getElementById("conteudo")?.focus();
      });
    },
    [origem],
  );
  const [tarefaCompleta, setTarefaCompleta] = useState<Tarefa | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let ativo = true;
    setErro(false);
    criarClienteNavegador()
      .from("tarefas")
      .select(
        "*, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, cor, unidade)",
      )
      .eq("id", props.tarefa.id)
      .single()
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error || !data) setErro(true);
        else setTarefaCompleta(data as unknown as Tarefa);
      });
    return () => {
      ativo = false;
    };
  }, [props.tarefa.id, tentativa]);
  if (!tarefaCompleta)
    return (
      <Dialogo
        titulo="Carregar tarefa"
        aoFechar={props.aoFechar}
        classe="m-0 ml-auto h-dvh max-h-dvh w-full max-w-none rounded-none border-l border-linha bg-papel p-6 text-tinta shadow-destaque lg:max-w-2xl"
      >
        <div>
          {erro ? (
            <AvisoErro
              mensagem="Não foi possível abrir a tarefa."
              aoTentar={() => setTentativa((n) => n + 1)}
            />
          ) : (
            <p role="status" className="text-sm text-tinta/70">
              Carregando tarefa…
            </p>
          )}
          <button
            className="botao botao-secundario mt-4"
            onClick={props.aoFechar}
          >
            Fechar
          </button>
        </div>
      </Dialogo>
    );
  return <EditorTarefa {...props} tarefa={tarefaCompleta} />;
}

/** Cabeçalho de bloco — a ficha técnica é dividida em seções nomeadas. */
function Bloco({
  titulo,
  subtitulo,
  children,
  id,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className="mt-5 rounded-xl border border-linha bg-campo/50 p-4"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-linha/80 pb-2">
        <h3 id={id} className="font-display text-sm font-bold text-tinta">
          {titulo}
        </h3>
        {subtitulo && (
          <span className="text-xs text-tinta/70">{subtitulo}</span>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}

/**
 * Painel de detalhe/edição de uma tarefa — aberto ao clicar num CartaoTarefa.
 */
function EditorTarefa({
  tarefa,
  aoFechar,
  aoAtualizar,
  membrosIniciais,
  frentesIniciais,
}: {
  tarefa: Tarefa;
  aoFechar: () => void;
  aoAtualizar?: () => void;
  membrosIniciais?: Membro[];
  frentesIniciais?: Frente[];
}) {
  const [mostrarAtividade, setMostrarAtividade] = useState(false);
  const [t, setT] = useState(tarefa);
  const ultimaSalva = useRef(tarefa);
  const gravacoes = useRef<Promise<void>>(Promise.resolve());
  const [salvandoCampo, setSalvandoCampo] = useState(false);
  const [membros, setMembros] = useState<Membro[]>(membrosIniciais ?? []);
  const [frentes, setFrentes] = useState<Frente[]>(frentesIniciais ?? []);
  const [arquivando, setArquivando] = useState(false);
  const [confirmandoArquivo, setConfirmandoArquivo] = useState(false);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoEntrega | null>(null);
  const [entregaAberta, setEntregaAberta] = useState(false);
  const [confirmandoCommit, setConfirmandoCommit] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  // Rascunho local da descrição: uma escrita por sessão pra não inundar historico.
  const [rascunho, setRascunho] = useState(tarefa.descricao ?? "");
  const [salvandoDescricao, setSalvandoDescricao] = useState(false);

  const [erroEdicao, avisar] = useState<string | null>(null);
  const [erroEntrega, setErroEntrega] = useState(false);
  const [carregandoEntrega, setCarregandoEntrega] = useState(true);
  const [salvandoPessoas, setSalvandoPessoas] = useState(false);
  const supabase = criarClienteNavegador();

  const criterios = useMemo(() => lerCriterios(rascunho), [rascunho]);
  const feitos = criterios.filter((c) => c.feito).length;
  const descricaoSuja = rascunho !== (t.descricao ?? "");

  async function carregarEstadoEntrega() {
    const { data, error } = await supabase
      .from("tarefas_estado_entrega")
      .select("*")
      .eq("tarefa_id", t.id)
      .maybeSingle();
    setErroEntrega(!!error);
    setCarregandoEntrega(false);
    if (!error) setEstado((data ?? null) as EstadoEntrega | null);
  }

  useEffect(() => {
    if (!(membrosIniciais && frentesIniciais)) {
      Promise.all([
        supabase
          .from("membros")
          .select("id, nome, papel, frente_id")
          .order("nome"),
        supabase.from("frentes").select("id, nome, cor, unidade").order("nome"),
      ]).then(([m, f]) => {
        if (m.error || f.error) {
          avisar(
            "Não foi possível carregar pessoas e frentes. Feche e tente novamente.",
          );
          return;
        }
        setMembros((m.data ?? []) as Membro[]);
        setFrentes((f.data ?? []) as unknown as Frente[]);
      });
    }
    supabase.auth.getUser().then(({ data }) => setMeuId(data.user?.id ?? null));
    carregarEstadoEntrega();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function tentarFechar() {
    if (salvandoCampo || salvandoDescricao || salvandoPessoas) return;
    if (descricaoSuja) {
      setConfirmandoSaida(true);
      return;
    }
    aoFechar();
  }

  const responsaveis = responsaveisDe(t);
  const souResponsavel = responsaveis.some((m) => m.id === meuId);
  const local = lerLocalEntrega(t.local_entrega);
  const unidade = t.frentes?.unidade
    ? (UNIDADES_FRENTE.find((u) => u.id === t.frentes!.unidade)?.nome ??
      t.frentes.unidade)
    : null;
  const temAjustePendente = !!(
    estado?.ultimo_resultado === "falta_algo" &&
    estado?.revisado_em &&
    (!estado.entregue_em ||
      new Date(estado.revisado_em) > new Date(estado.entregue_em))
  );

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

  function salvarCampo(
    campo: keyof Tarefa,
    valor: string | number | boolean | null,
  ) {
    setT((atual) => ({ ...atual, [campo]: valor }));
    setSalvandoCampo(true);
    gravacoes.current = gravacoes.current.then(async () => {
      const anterior = ultimaSalva.current[campo];
      if (anterior === valor) return;
      const { error } = await supabase
        .from("tarefas")
        .update({ [campo]: valor })
        .eq("id", t.id);
      if (error) {
        setT((atual) =>
          atual[campo] === valor ? { ...atual, [campo]: anterior } : atual,
        );
        avisar("Não foi possível salvar a alteração.");
      } else {
        ultimaSalva.current = { ...ultimaSalva.current, [campo]: valor };
        aoAtualizar?.();
      }
    });
    const ultima = gravacoes.current;
    void ultima.finally(() => {
      if (gravacoes.current === ultima) setSalvandoCampo(false);
    });
  }

  async function salvarDescricao() {
    const valor = rascunho.trim() ? rascunho : null;
    setSalvandoDescricao(true);
    const { error } = await supabase
      .from("tarefas")
      .update({ descricao: valor })
      .eq("id", t.id);
    setSalvandoDescricao(false);
    if (error) {
      avisar("Não deu pra salvar os critérios. Tenta de novo.");
      return;
    }
    setT((atual) => ({ ...atual, descricao: valor }));
    aoAtualizar?.();
  }

  async function salvarFrente(frenteId: string) {
    if (salvandoPessoas) return;
    setSalvandoPessoas(true);
    const valor = frenteId ? Number(frenteId) : null;
    const frenteEncontrada = frentes.find((f) => f.id === valor) ?? null;
    const anterior = { frente_id: t.frente_id, frentes: t.frentes };
    setT((atual) => ({
      ...atual,
      frente_id: valor,
      frentes: frenteEncontrada,
    }));
    const { error } = await supabase
      .from("tarefas")
      .update({ frente_id: valor })
      .eq("id", t.id);
    setSalvandoPessoas(false);
    if (error) {
      setT((atual) => ({ ...atual, ...anterior }));
      avisar("Não deu pra mudar a frente. Tenta de novo.");
      return;
    }
    aoAtualizar?.();
  }

  async function salvarResponsavel(membroId: string) {
    if (salvandoPessoas) return;
    setSalvandoPessoas(true);
    const atual = responsaveisDe(t)[0];
    const membro = membroId
      ? (membros.find((m) => m.id === membroId) ?? null)
      : null;
    setT((estadoAtual) => ({
      ...estadoAtual,
      responsaveis: membro ? [{ membro }] : [],
    }));

    const resultado = !membroId
      ? atual
        ? await supabase
            .from("tarefa_responsaveis")
            .delete()
            .eq("tarefa_id", t.id)
            .eq("membro_id", atual.id)
        : { error: null }
      : atual
        ? await supabase
            .from("tarefa_responsaveis")
            .update({ membro_id: membroId })
            .eq("tarefa_id", t.id)
            .eq("membro_id", atual.id)
        : await supabase
            .from("tarefa_responsaveis")
            .insert({ tarefa_id: t.id, membro_id: membroId });

    setSalvandoPessoas(false);
    if (resultado.error) {
      setT((estadoAtual) => ({
        ...estadoAtual,
        responsaveis: atual ? [{ membro: atual }] : [],
      }));
      avisar("Não deu pra mudar o responsável. Tenta de novo.");
      return;
    }
    aoAtualizar?.();
  }

  async function arquivar() {
    setArquivando(true);
    const { error } = await supabase
      .from("tarefas")
      .update({ arquivada: true })
      .eq("id", t.id);
    setArquivando(false);
    if (error) {
      avisar("Não deu pra arquivar. Tenta de novo.");
      return;
    }
    setConfirmandoArquivo(false);
    aoAtualizar?.();
    aoFechar();
  }

  return (
    <Dialogo
      titulo={t.titulo}
      aoFechar={tentarFechar}
      focoNoPainel
      classe="m-0 ml-auto h-dvh max-h-dvh w-full max-w-none rounded-none border-0 border-l border-linha bg-papel p-0 text-tinta shadow-destaque lg:max-w-2xl"
    >
      <div className="min-h-full pb-8">
        {/* ---------- 1. Cabeçalho destacado ---------- */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-linha bg-casca/90 px-5 py-3.5 backdrop-blur-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-linha bg-papel px-2.5 py-0.5 font-mono text-xs font-semibold text-tinta">
              #{t.id} · {ESCOPOS.find((e) => e.id === t.escopo)?.nome ?? t.escopo}
            </span>
            {t.frentes && (
              <span
                className={`inline-flex max-w-[12rem] items-center gap-1.5 rounded-full border bg-papel px-2.5 py-0.5 text-xs font-medium ${
                  CLASSES_COR_FRENTE[t.frentes.cor ?? "ferro"]
                }`}
              >
                <i
                  aria-hidden="true"
                  className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                    CLASSES_COR_FRENTE_PREENCHIDA[t.frentes.cor ?? "ferro"]
                  }`}
                />
                <span className="truncate">{t.frentes.nome}</span>
              </span>
            )}
            {unidade && (
              <span className="rounded-full border border-linha bg-campo px-2.5 py-0.5 font-mono text-xs text-tinta/70">
                {unidade}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(salvandoCampo || salvandoPessoas) && (
              <span role="status" className="font-mono text-xs text-musgo">
                Salvando…
              </span>
            )}
            <button
              type="button"
              onClick={tentarFechar}
              disabled={salvandoCampo || salvandoDescricao || salvandoPessoas}
              aria-label="Fechar detalhes da tarefa"
              className="botao botao-secundario min-h-8 px-2.5 py-1 text-xs"
            >
              <IconeFechar className="h-3.5 w-3.5" />
              Fechar
            </button>
          </div>
        </div>

        <div className="px-5 pt-5 sm:px-6">
          {erroEdicao && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-trigo bg-trigo/15 px-3 py-2 text-sm text-tinta"
            >
              {erroEdicao}
            </p>
          )}

          <label className="block">
            <span className="sr-only">Título da tarefa</span>
            <input
              id="detalhe-titulo"
              value={t.titulo}
              onChange={(e) =>
                setT((atual) => ({ ...atual, titulo: e.target.value }))
              }
              onBlur={(e) => {
                if (e.target.value.trim())
                  salvarCampo("titulo", e.target.value.trim());
                else
                  setT((atual) => ({
                    ...atual,
                    titulo: ultimaSalva.current.titulo,
                  }));
              }}
              className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-2xl font-extrabold tracking-tight text-tinta transition-colors duration-micro ease-entrada hover:border-linha focus:border-musgo focus:bg-campo focus:outline-none"
            />
          </label>

          {/* Fluxo visual + orientação didática do próximo passo */}
          <FluxoTarefa
            modo="progresso"
            status={t.status}
            pendenteGit={!!estado?.pendente_git}
            temRevisor={!!t.revisor_id}
            souResponsavel={souResponsavel}
            temAjustePendente={temAjustePendente}
          />

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <label className="block text-xs font-semibold text-tinta/70">
              Status
              <select
                value={t.status}
                onChange={(e) => salvarCampo("status", e.target.value)}
                className="campo mt-1 py-2 text-xs font-medium"
              >
                {STATUS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-tinta/70">
              Prioridade
              <select
                value={t.prioridade}
                onChange={(e) => salvarCampo("prioridade", e.target.value)}
                className="campo mt-1 py-2 text-xs font-medium"
              >
                {PRIORIDADES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-tinta/70">
              Início
              <input
                type="date"
                value={t.inicio ?? ""}
                onChange={(e) =>
                  setT((atual) => ({ ...atual, inicio: e.target.value || null }))
                }
                onBlur={(e) => salvarCampo("inicio", e.target.value || null)}
                className="campo mt-1 py-2 font-mono text-xs"
              />
            </label>
            <label className="block text-xs font-semibold text-tinta/70">
              Prazo
              <input
                type="date"
                value={t.prazo ?? ""}
                onChange={(e) =>
                  setT((atual) => ({ ...atual, prazo: e.target.value || null }))
                }
                onBlur={(e) => salvarCampo("prazo", e.target.value || null)}
                className="campo mt-1 py-2 font-mono text-xs"
              />
            </label>
          </div>

          {/* ---------- 2. Critérios de aceite (DoD) ---------- */}
          <Bloco
            id="bloco-criterios"
            titulo="Descrição e critérios de aceite"
            subtitulo={
              criterios.length > 0
                ? `${feitos} de ${criterios.length} concluídos`
                : "Dica: linhas - [ ] viram checklist"
            }
          >
            {criterios.length > 0 && (
              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-linha">
                    <div
                      className="h-full w-full origin-left rounded-full bg-musgo transition-transform duration-micro ease-entrada"
                      style={{
                        transform: `scaleX(${feitos / criterios.length})`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-xs font-semibold text-musgo">
                    ✓ {feitos}/{criterios.length}
                  </span>
                </div>

                <ul className="space-y-1.5">
                  {criterios.map((c) => (
                    <li key={c.linha}>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-linha bg-papel px-3 py-2 text-sm transition-colors duration-micro ease-entrada hover:border-musgo">
                        <input
                          type="checkbox"
                          checked={c.feito}
                          onChange={(e) =>
                            setRascunho((atual) =>
                              alternarCriterio(atual, c.linha, e.target.checked),
                            )
                          }
                          className="mt-0.5 h-4 w-4 shrink-0 appearance-none rounded-sm border border-linha bg-campo checked:border-musgo checked:bg-musgo"
                        />
                        <span
                          className={`min-w-0 break-words ${c.feito ? "text-tinta/70 line-through" : "text-tinta"}`}
                        >
                          {c.texto || (
                            <em className="text-tinta/70">
                              (critério sem texto)
                            </em>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <label className="block text-xs font-semibold text-tinta/70">
              Texto e checklist (markdown)
              <textarea
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                rows={criterios.length > 0 ? 3 : 4}
                placeholder={
                  'Detalhes da tarefa.\nUma linha "- [ ] ..." vira critério de aceite marcável aqui em cima.'
                }
                className="campo mt-1.5"
              />
            </label>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {descricaoSuja ? (
                  <>
                    <button
                      type="button"
                      onClick={salvarDescricao}
                      disabled={salvandoDescricao}
                      className="botao botao-primario min-h-8 px-3 py-1.5 text-xs"
                    >
                      {salvandoDescricao ? "Salvando…" : "Salvar descrição"}
                    </button>
                    <button
                      type="button"
                      disabled={salvandoDescricao}
                      onClick={() => setRascunho(t.descricao ?? "")}
                      className="botao botao-discreto min-h-8 px-2.5 py-1.5 text-xs"
                    >
                      Descartar
                    </button>
                    <span className="rounded-full bg-trigo/25 px-2 py-0.5 font-mono text-xs font-semibold text-tinta">
                      alterações não salvas
                    </span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-musgo">
                    <IconeCheck className="h-3.5 w-3.5" />
                    tudo salvo
                  </span>
                )}
              </div>
              <span className="flex items-center gap-1 text-xs text-tinta/70">
                <IconeDica className="h-3.5 w-3.5 text-broto" />1 registro na
                Trilha por salvamento
              </span>
            </div>
          </Bloco>

          {/* ---------- 3. Pessoas ---------- */}
          <Bloco id="bloco-pessoas" titulo="Pessoas envolvidas">
            <div className="grid gap-3 sm:grid-cols-2">
              {t.escopo === "frente" ? (
                <div className="rounded-lg border border-linha bg-papel p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-tinta/70">
                    <IconeUsuario className="h-3.5 w-3.5" />
                    Responsáveis ({responsaveis.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {responsaveis.length > 0 ? (
                      responsaveis.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-linha bg-campo px-2 py-0.5 text-xs font-medium text-tinta"
                        >
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-musgo font-mono text-xs text-campo">
                            {iniciaisDe(m.nome).slice(0, 1)}
                          </span>
                          {m.nome}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-tinta/70">
                        sem responsável
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-tinta/70">
                    Tarefa de frente: atribuída automaticamente a quem estava
                    nela na criação.
                  </p>
                </div>
              ) : (
                <>
                  <label className="block text-xs font-semibold text-tinta/70">
                    Responsável
                    <select
                      disabled={salvandoPessoas || salvandoCampo}
                      value={responsaveis[0]?.id ?? ""}
                      onChange={(e) => salvarResponsavel(e.target.value)}
                      className="campo mt-1"
                    >
                      <option value="">sem dono</option>
                      {membros
                        .filter((m) => m.id !== t.revisor_id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-tinta/70">
                    Frente (matéria)
                    <select
                      disabled={salvandoPessoas}
                      value={t.frente_id ?? ""}
                      onChange={(e) => salvarFrente(e.target.value)}
                      className="campo mt-1"
                    >
                      <option value="">sem frente</option>
                      {frentes.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              <label className="block text-xs font-semibold text-tinta/70">
                Revisor (opcional)
                <select
                  disabled={salvandoPessoas || salvandoCampo}
                  value={t.revisor_id ?? ""}
                  onChange={(e) =>
                    salvarCampo("revisor_id", e.target.value || null)
                  }
                  className="campo mt-1"
                >
                  <option value="">Sem revisor</option>
                  {membros
                    .filter((m) => !responsaveis.some((r) => r.id === m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                </select>
                <span className="mt-1.5 block font-normal text-xs text-tinta/70">
                  Sem revisor, a entrega conclui a tarefa direto.
                </span>
              </label>
            </div>
          </Bloco>

          {/* ---------- 4. Observações ---------- */}
          <Bloco id="bloco-observacoes" titulo="Observações">
            <textarea
              aria-label="Observações"
              value={t.observacoes ?? ""}
              onChange={(e) =>
                setT((atual) => ({ ...atual, observacoes: e.target.value }))
              }
              onBlur={(e) => salvarCampo("observacoes", e.target.value || null)}
              rows={3}
              placeholder="Notas de quem entregou ou combinados rápidos…"
              className="campo"
            />
          </Bloco>

          {/* ---------- 5. Entregáveis e evidências ---------- */}
          <Bloco id="bloco-entregaveis" titulo="Entregáveis e evidências">
            <label className="block text-xs font-semibold text-tinta/70">
              Local de entrega
              <input
                value={t.local_entrega ?? ""}
                onChange={(e) =>
                  setT((atual) => ({ ...atual, local_entrega: e.target.value }))
                }
                onBlur={(e) =>
                  salvarCampo("local_entrega", e.target.value || null)
                }
                placeholder="Link do Drive, Forms, PR do GitHub… (opcional)"
                className="campo mt-1"
              />
            </label>
            {local && (
              <p className="mt-1.5 font-mono text-xs text-tinta/70">
                {local.tipo === "link" ? (
                  <a
                    href={local.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={local.titulo}
                    className="font-semibold text-musgo underline underline-offset-4 hover:text-tinta"
                  >
                    abrir {local.rotulo} ↗
                  </a>
                ) : (
                  <span title={local.titulo}>
                    não é um link http(s) — fica como anotação
                  </span>
                )}
              </p>
            )}

            {erroEntrega && (
              <AvisoErro
                mensagem="Não foi possível consultar a entrega."
                aoTentar={carregarEstadoEntrega}
              />
            )}
            {carregandoEntrega && (
              <p role="status" className="mt-3 text-sm text-tinta/70">
                Carregando entrega…
              </p>
            )}
            {!erroEntrega && !carregandoEntrega && (
              <>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-linha bg-papel px-3.5 py-3">
                  <div>
                    <p className="text-xs font-semibold text-tinta">
                      Registro formal de entrega
                    </p>
                    <p className="text-xs text-tinta/70">
                      {souResponsavel
                        ? "Ao entregar, você registra o arquivo no Drive e o que mudou."
                        : "Apenas os responsáveis atribuídos podem registrar entrega."}
                    </p>
                  </div>
                  {souResponsavel && (
                    <button
                      type="button"
                      onClick={() => setEntregaAberta(true)}
                      className="botao botao-destaque min-h-9 px-3.5 py-1.5 text-xs"
                    >
                      <IconeEntregas className="h-3.5 w-3.5" />
                      Entregar
                    </button>
                  )}
                </div>

                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <div
                    className={`rounded-xl border p-3 ${
                      estado?.pendente_git
                        ? "border-trigo bg-trigo/15"
                        : "border-linha bg-papel"
                    }`}
                  >
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-tinta/70">
                      <IconeGit className="h-3.5 w-3.5" />
                      Falta commitar?
                    </p>
                    <p className="mt-1 text-sm font-bold text-tinta">
                      {estado?.pendente_git
                        ? "Sim — commit ainda não confirmado"
                        : "Não"}
                    </p>
                    <p className="mt-1 text-xs text-tinta/70">
                      Calculado pela última entrega (não editável).
                    </p>
                    {estado?.pendente_git && estado.commit_nome && (
                      <p className="mt-1.5 break-words rounded bg-campo px-2 py-1 font-mono text-xs text-tinta">
                        {estado.commit_nome}
                      </p>
                    )}
                    {estado?.pendente_git && souResponsavel && (
                      <button
                        type="button"
                        onClick={confirmarCommit}
                        disabled={confirmandoCommit}
                        className="botao botao-primario mt-2 min-h-8 px-2.5 py-1 text-xs"
                      >
                        {confirmandoCommit
                          ? "Confirmando…"
                          : "Confirmar commit"}
                      </button>
                    )}
                  </div>

                  <label className="block cursor-pointer rounded-xl border border-linha bg-papel p-3 transition-colors duration-micro ease-entrada hover:border-musgo">
                    <p className="text-xs font-semibold text-tinta/70">
                      Alguém marcou que subiu?
                    </p>
                    <span className="mt-1 flex items-center gap-2 text-sm font-bold text-tinta">
                      <input
                        type="checkbox"
                        checked={t.subiu_git}
                        onChange={(e) =>
                          salvarCampo("subiu_git", e.target.checked)
                        }
                      />
                      {t.subiu_git
                        ? "Sim, marcado pela equipe"
                        : "Ainda não marcaram"}
                    </span>
                    <span className="mt-1 block text-xs text-tinta/70">
                      Marcação manual da equipe, independente do cálculo ao
                      lado.
                    </span>
                  </label>
                </div>

                {estado?.ultima_entrega_id ? (
                  <div className="mt-3 rounded-xl border border-linha bg-papel p-3 text-sm">
                    <p className="font-mono text-xs text-tinta/70">
                      Última entrega por{" "}
                      <span className="font-semibold text-tinta">
                        {estado.entrega_autor_nome}
                      </span>{" "}
                      em{" "}
                      {estado.entregue_em && dataCurta(estado.entregue_em)} ·
                      arquivo:{" "}
                      <span className="break-words font-semibold text-tinta">
                        {estado.arquivo_drive}
                      </span>
                    </p>
                    {estado.o_que_mudou && (
                      <p className="mt-1.5 text-sm text-tinta">
                        {estado.o_que_mudou}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-tinta/70">
                    Ainda não há entrega formal registrada.
                  </p>
                )}

                <NotaRevisor
                  tarefaId={t.id}
                  entregueEm={estado?.entregue_em ?? null}
                />
              </>
            )}

            <div className="mt-4">
              <label className="block text-xs font-semibold text-tinta/70">
                Nº da issue no GitHub
                <span className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={t.issue_numero ?? ""}
                    onChange={(e) =>
                      setT((atual) => ({
                        ...atual,
                        issue_numero: e.target.value
                          ? Number(e.target.value)
                          : null,
                      }))
                    }
                    onBlur={(e) => {
                      if (e.target.checkValidity())
                        salvarCampo(
                          "issue_numero",
                          e.target.value ? Number(e.target.value) : null,
                        );
                      else
                        setT((atual) => ({
                          ...atual,
                          issue_numero: ultimaSalva.current.issue_numero,
                        }));
                    }}
                    className="campo font-mono text-xs"
                  />
                  {t.issue_numero && (
                    <span className="shrink-0">
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

          <details
            className="mt-5 rounded-xl border border-linha bg-campo/50 px-4 py-3"
            onToggle={(e) => setMostrarAtividade(e.currentTarget.open)}
          >
            <summary className="cursor-pointer py-1 font-display text-sm font-bold text-tinta">
              Atividade recente na Trilha
            </summary>
            {mostrarAtividade && <AtividadeTarefa tarefaId={t.id} />}
          </details>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-linha bg-casca/50 px-4 py-3">
            <p className="text-xs text-tinta/70">
              Arquivar remove do quadro e do calendário. O histórico fica salvo e
              pode ser restaurado.
            </p>
            <button
              type="button"
              onClick={() => setConfirmandoArquivo(true)}
              disabled={arquivando}
              className="botao botao-secundario min-h-9 shrink-0 px-3 py-1.5 text-xs hover:border-trigo"
            >
              <IconeArquivo className="h-3.5 w-3.5" />
              {arquivando ? "Arquivando…" : "Arquivar tarefa"}
            </button>
          </div>
        </div>
      </div>

      {confirmandoArquivo && (
        <ConfirmarAcao
          titulo="Arquivar esta tarefa?"
          descricao={
            <>
              <strong className="font-semibold text-tinta">{t.titulo}</strong>{" "}
              sai do quadro, do calendário, da Semana e do painel da frente, e
              passa a aparecer no filtro “arquivadas” do quadro. Nada é apagado:
              o histórico dela continua na Trilha, e dá para restaurar quando
              quiser.
            </>
          }
          rotuloConfirmar="Arquivar"
          executando={arquivando}
          aoConfirmar={arquivar}
          aoCancelar={() => setConfirmandoArquivo(false)}
        />
      )}

      {entregaAberta && (
        <ModalEntrega
          tarefaId={t.id}
          aoFechar={() => setEntregaAberta(false)}
          aoEntregar={() => {
            void supabase
              .from("tarefas")
              .select("status")
              .eq("id", t.id)
              .single()
              .then(({ data, error: erroStatus }) => {
                if (erroStatus || !data) {
                  avisar(
                    "Entrega registrada. Feche e reabra para consultar o status atualizado.",
                  );
                  return;
                }
                setT((atual) => ({ ...atual, status: data.status }));
                ultimaSalva.current = {
                  ...ultimaSalva.current,
                  status: data.status,
                };
              });
            carregarEstadoEntrega();
            aoAtualizar?.();
          }}
        />
      )}

      {confirmandoSaida && (
        <ConfirmarAcao
          titulo="Sair sem salvar a descrição?"
          descricao={
            <>
              A descrição e os critérios têm alterações ainda não salvas. Fechar
              agora descarta o rascunho — a descrição da tarefa continua como
              estava. Cancele e use “Salvar descrição” para gravar.
            </>
          }
          rotuloConfirmar="Descartar e fechar"
          aoConfirmar={() => {
            setConfirmandoSaida(false);
            aoFechar();
          }}
          aoCancelar={() => setConfirmandoSaida(false)}
        />
      )}
    </Dialogo>
  );
}
