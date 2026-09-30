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
      <Dialogo titulo="Carregar tarefa" aoFechar={props.aoFechar}>
        <div className="p-5">
          {erro ? (
            <AvisoErro
              mensagem="Não foi possível abrir a tarefa."
              aoTentar={() => setTentativa((n) => n + 1)}
            />
          ) : (
            <p role="status">Carregando tarefa…</p>
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
  children,
  id,
}: {
  titulo: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section aria-labelledby={id} className="mt-5 border-t border-linha pt-4">
      <h3 id={id} className="font-display text-sm font-semibold text-tinta">
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
  /** Se a página que abriu o painel já tem essas listas carregadas (ex.: Quadro),
   *  passa aqui pra não duplicar a consulta — só id/nome são usados nos selects. */
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

  // Rascunho local da descrição. Marcar uma checkbox NÃO grava no banco: todo
  // UPDATE em tarefas vira linha em historico (append-only, é a evidência
  // avaliada no PI), então um clique = uma linha de trilha inundaria
  // justamente o que a trilha existe pra provar. Uma escrita por sessão.
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
    // Rascunho pendente abre a confirmação do app em vez do confirm nativo,
    // que não diz o que se perde nem oferece o caminho de volta.
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
        // Uma resposta antiga não pode apagar uma edição mais recente.
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
    setT((estado) => ({ ...estado, responsaveis: membro ? [{ membro }] : [] }));

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
      setT((estado) => ({
        ...estado,
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
      classe="m-0 ml-auto h-dvh max-h-dvh w-full max-w-none border-0 bg-campo p-0 text-tinta backdrop:bg-tinta/40 lg:max-w-2xl"
    >
      <div className="min-h-full p-4 sm:p-6">
        {/* ---------- 1. Cabeçalho e ciclo de vida ---------- */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-xs text-tinta/70">
              {ESCOPOS.find((e) => e.id === t.escopo)?.nome ?? t.escopo}
            </span>
            {t.frentes && (
              <span
                className={`flex max-w-[12rem] items-center gap-1 border px-1.5 py-0.5 text-xs ${
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
              <span className="border border-linha px-1.5 py-0.5 text-xs text-tinta/70">
                {unidade}
              </span>
            )}
          </div>
          <button
            onClick={tentarFechar}
            disabled={salvandoCampo || salvandoDescricao || salvandoPessoas}
            aria-label="Fechar detalhes da tarefa"
            className="shrink-0 border border-linha px-2 py-1 text-xs text-tinta/70 transition-colors duration-micro ease-entrada hover:bg-casca hover:text-tinta"
          >
            fechar
          </button>
        </div>

        {erroEdicao && (
          <p role="alert" className="mt-3 border-l-2 border-trigo pl-3 text-sm">
            {erroEdicao}
          </p>
        )}
        <p role="status" className="mt-2 text-xs text-tinta/70">
          {salvandoCampo || salvandoPessoas ? "Salvando alteração…" : ""}
        </p>
        <label className="mt-2 block">
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
            className="w-full border border-transparent bg-transparent font-display text-xl font-bold transition-colors duration-micro ease-entrada hover:border-linha focus:border-linha focus:outline-none"
          />
        </label>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="block text-xs text-tinta/70">
            Status
            <select
              value={t.status}
              onChange={(e) => salvarCampo("status", e.target.value)}
              className="mt-1 block w-full border border-linha bg-casca px-2 py-2 text-xs"
            >
              {STATUS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-tinta/70">
            Prioridade
            <select
              value={t.prioridade}
              onChange={(e) => salvarCampo("prioridade", e.target.value)}
              className="mt-1 block w-full border border-linha bg-casca px-2 py-2 text-xs"
            >
              {PRIORIDADES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-tinta/70">
            Início
            <input
              type="date"
              value={t.inicio ?? ""}
              onChange={(e) =>
                setT((atual) => ({ ...atual, inicio: e.target.value || null }))
              }
              onBlur={(e) => salvarCampo("inicio", e.target.value || null)}
              className="mt-1 block w-full border border-linha bg-casca px-2 py-2 font-mono text-xs text-tinta"
            />
          </label>
          <label className="block text-xs text-tinta/70">
            Prazo
            <input
              type="date"
              value={t.prazo ?? ""}
              onChange={(e) =>
                setT((atual) => ({ ...atual, prazo: e.target.value || null }))
              }
              onBlur={(e) => salvarCampo("prazo", e.target.value || null)}
              className="mt-1 block w-full border border-linha bg-casca px-2 py-2 font-mono text-xs text-tinta"
            />
          </label>
        </div>

        {/* ---------- 2. Critérios de aceite (DoD) ---------- */}
        <Bloco id="bloco-criterios" titulo="Descrição e critérios de aceite">
          {criterios.length > 0 && (
            <>
              <p className="font-mono text-xs text-tinta/70">
                ✓ {feitos}/{criterios.length} concluídos
              </p>
              <ul className="mt-2 space-y-1">
                {criterios.map((c) => (
                  <li key={c.linha}>
                    <label className="flex cursor-pointer items-start gap-2 border border-linha bg-casca px-3 py-1.5 text-sm transition-colors duration-micro ease-entrada hover:border-musgo">
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
                        className={`min-w-0 break-words ${c.feito ? "text-tinta/70 line-through" : ""}`}
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
            </>
          )}

          <label className="mt-3 block text-xs text-tinta/70">
            Descrição
            <textarea
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              rows={criterios.length > 0 ? 3 : 4}
              placeholder={
                'Detalhes da tarefa.\nUma linha "- [ ] ..." vira critério de aceite marcável aqui em cima.'
              }
              className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm text-tinta"
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
                  className="bg-tinta px-3 py-1.5 text-xs text-campo transition-colors duration-micro ease-entrada hover:bg-musgo disabled:opacity-50"
                >
                  {salvandoDescricao ? "salvando…" : "Salvar descrição"}
                </button>
                <button
                  disabled={salvandoDescricao}
                  onClick={() => setRascunho(t.descricao ?? "")}
                  className="text-xs text-tinta/70 underline underline-offset-4 hover:text-tinta"
                >
                  descartar
                </button>
                <span className="font-mono text-xs text-tinta">
                  alterações não salvas
                </span>
              </>
            ) : (
              <span className="font-mono text-xs text-tinta/70">
                tudo salvo
              </span>
            )}
          </div>
        </Bloco>

        <Bloco id="bloco-pessoas" titulo="Pessoas">
          <div className="grid gap-3 sm:grid-cols-2">
            {t.escopo === "frente" ? (
              <p className="text-xs text-tinta/70">
                Responsáveis ({responsaveis.length})
                <span className="mt-1 block font-corpo text-sm text-tinta">
                  {responsaveis.map((m) => m.nome).join(", ") ||
                    "sem responsável"}
                </span>
                <span className="mt-1 block font-corpo text-xs text-tinta/70">
                  Tarefa de frente: quem responde é toda a frente, atribuída
                  pelo banco.
                </span>
              </p>
            ) : (
              <>
                <label className="block text-xs text-tinta/70">
                  Responsável
                  <select
                    disabled={salvandoPessoas || salvandoCampo}
                    value={responsaveis[0]?.id ?? ""}
                    onChange={(e) => salvarResponsavel(e.target.value)}
                    className="mt-1 block w-full border border-linha bg-casca px-2 py-2 font-corpo text-sm text-tinta"
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
                <label className="block text-xs text-tinta/70">
                  Frente (matéria)
                  <select
                    disabled={salvandoPessoas}
                    value={t.frente_id ?? ""}
                    onChange={(e) => salvarFrente(e.target.value)}
                    className="mt-1 block w-full border border-linha bg-casca px-2 py-2 font-corpo text-sm text-tinta"
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

            <label className="block text-xs text-tinta/70">
              Revisor (opcional)
              <select
                disabled={salvandoPessoas || salvandoCampo}
                value={t.revisor_id ?? ""}
                onChange={(e) =>
                  salvarCampo("revisor_id", e.target.value || null)
                }
                className="mt-1 block w-full border border-linha bg-casca px-2 py-2 font-corpo text-sm text-tinta"
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
              <span className="mt-1 block font-corpo text-xs text-tinta/70">
                Sem revisor, a tarefa conclui direto quando for entregue.
              </span>
            </label>
          </div>
        </Bloco>

        {/* ---------- 3. Observações ---------- */}
        <Bloco id="bloco-observacoes" titulo="Observações">
          <textarea
            aria-label="Observações"
            value={t.observacoes ?? ""}
            onChange={(e) =>
              setT((atual) => ({ ...atual, observacoes: e.target.value }))
            }
            onBlur={(e) => salvarCampo("observacoes", e.target.value || null)}
            rows={3}
            placeholder="Notas de quem entregou…"
            className="w-full border border-linha bg-casca px-3 py-2 text-sm"
          />
        </Bloco>

        {/* ---------- 4. Entregáveis e evidências ---------- */}
        <Bloco id="bloco-entregaveis" titulo="Entregáveis e evidências">
          <label className="block text-xs text-tinta/70">
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
              className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm text-tinta"
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

          {erroEntrega && (
            <AvisoErro
              mensagem="Não foi possível consultar a entrega."
              aoTentar={carregarEstadoEntrega}
            />
          )}
          {carregandoEntrega && (
            <p role="status" className="mt-3 text-sm">
              Carregando entrega…
            </p>
          )}
          {!erroEntrega && !carregandoEntrega && (
            <>
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="text-xs text-tinta/70">Entrega</span>
                {souResponsavel && (
                  <button
                    onClick={() => setEntregaAberta(true)}
                    className="bg-tinta px-3 py-1.5 text-xs text-campo transition-colors duration-micro ease-entrada hover:bg-musgo"
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
                <div
                  className={`border px-3 py-2 ${estado?.pendente_git ? "border-trigo bg-trigo/10" : "border-linha bg-casca"}`}
                >
                  <p className="text-xs text-tinta/70">Falta commitar?</p>
                  <p className="mt-1 text-sm font-semibold">
                    {estado?.pendente_git
                      ? "Sim — a entrega pede commit e ele ainda não foi confirmado"
                      : "Não"}
                  </p>
                  <p className="mt-1 text-xs text-tinta/70">
                    Calculado a partir da última entrega, não editável.
                  </p>
                  {estado?.pendente_git && estado.commit_nome && (
                    <p className="mt-1 break-words font-mono text-xs text-tinta/70">
                      commit:{" "}
                      <span className="text-tinta">{estado.commit_nome}</span>
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
                  <p className="text-xs text-tinta/70">
                    Alguém marcou que subiu?
                  </p>
                  <span className="mt-1 flex items-center gap-2 text-sm font-semibold">
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
                    Marcação manual da equipe, independente do cálculo ao lado.
                  </span>
                </label>
              </div>

              {estado?.ultima_entrega_id ? (
                <div className="mt-2 text-sm text-tinta/70">
                  <p className="font-mono text-xs text-tinta/70">
                    Entregue por{" "}
                    <span className="text-tinta">
                      {estado.entrega_autor_nome}
                    </span>{" "}
                    em {estado.entregue_em && dataCurta(estado.entregue_em)} ·
                    arquivo:{" "}
                    <span className="break-words text-tinta">
                      {estado.arquivo_drive}
                    </span>
                  </p>
                  {estado.o_que_mudou && (
                    <p className="mt-1">{estado.o_que_mudou}</p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-tinta/70">
                  Ainda não foi entregue.
                </p>
              )}

              <NotaRevisor
                tarefaId={t.id}
                entregueEm={estado?.entregue_em ?? null}
              />
            </>
          )}

          <div className="mt-4">
            <label className="block text-xs text-tinta/70">
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
                  className="block w-full border border-linha bg-casca px-2 py-2 font-mono text-xs text-tinta"
                />
                {t.issue_numero && (
                  <span className="shrink-0 font-mono text-xs">
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

        {/* Separada do resto: é a única ação da tela que tira a tarefa das
            superfícies de trabalho. Reversível, então sem alarme — mas com
            espaço próprio, rótulo em corpo e explicação do que acontece. */}
        <details
          className="mt-5 border-t border-linha pt-3"
          onToggle={(e) => setMostrarAtividade(e.currentTarget.open)}
        >
          <summary className="cursor-pointer py-2 text-sm font-semibold">
            Atividade recente
          </summary>
          {mostrarAtividade && <AtividadeTarefa tarefaId={t.id} />}
        </details>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-linha pt-4">
          <p className="text-xs text-tinta/70">
            Some do quadro e do calendário. O histórico fica, e dá para
            restaurar.
          </p>
          <button
            onClick={() => setConfirmandoArquivo(true)}
            disabled={arquivando}
            className="shrink-0 border border-linha px-3 py-1.5 text-xs transition-colors duration-micro ease-entrada hover:border-trigo hover:text-tinta disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-musgo"
          >
            {arquivando ? "arquivando…" : "Arquivar tarefa"}
          </button>
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
              .then(({ data, error }) => {
                if (error || !data) {
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
