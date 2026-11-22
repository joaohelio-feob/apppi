"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import {
  PRIORIDADES,
  responsaveisDe,
  type Escopo,
  type Frente,
  type Membro,
  type Status,
  type Tarefa,
} from "@/lib/types";
import QuadroTarefas from "@/components/tarefa/QuadroTarefas";
import LinhaTarefa from "@/components/LinhaTarefa";
import Botao from "@/components/ui/Botao";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import ListaArquivadas from "@/components/ListaArquivadas";
import ConfirmarAcao from "@/components/ConfirmarAcao";
import { useNovaTarefa } from "@/components/NovaTarefaProvider";
import { useToast } from "@/components/ToastProvider";
import {
  IconeArquivo,
  IconeBusca,
  IconeDica,
  IconeFiltro,
  IconeFrentes,
  IconeLista,
  IconeLote,
  IconeMais,
  IconeQuadro,
  IconeUsuario,
} from "@/components/ui/Icones";

const CHAVE_MINHAS = "pi-quadro-somente-minhas";
const CHAVE_VISAO = "pi-quadro-visao";
const CHAVE_ARQUIVADAS = "pi-quadro-arquivadas";

/** Quanto tempo uma mudança otimista resiste a um refetch que a contradiga. */
const VALIDADE_OTIMISTA = 10_000;

type Visao = Escopo;

const VISOES: Visao[] = ["individual", "frente"];

export default function Quadro() {
  const [formato, setFormato] = useState("quadro");
  const [agrupar, setAgrupar] = useState(false);
  const [erroCarga, setErroCarga] = useState(false);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [visao, setVisao] = useState<Visao>("individual");
  const [busca, setBusca] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");
  const [filtroFrente, setFiltroFrente] = useState("");
  const [somenteMinhas, setSomenteMinhas] = useState(false);
  const [verArquivadas, setVerArquivadas] = useState(false);
  const [arquivando, setArquivando] = useState<Tarefa | null>(null);
  const [executandoArquivo, setExecutandoArquivo] = useState(false);

  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const otimistas = useRef(new Map<number, { status: Status; ate: number }>());
  const timerRecarga = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { abrir } = useNovaTarefa();
  const { avisar } = useToast();
  const supabase = criarClienteNavegador();

  useEffect(() => {
    setFormato(
      localStorage.getItem("pi-quadro-formato") === "lista"
        ? "lista"
        : "quadro",
    );
    setAgrupar(localStorage.getItem("pi-quadro-agrupar") === "1");
    setSomenteMinhas(localStorage.getItem(CHAVE_MINHAS) === "1");
    const visaoSalva = localStorage.getItem(CHAVE_VISAO);
    if (visaoSalva === "frente" || visaoSalva === "individual")
      setVisao(visaoSalva);
    setVerArquivadas(localStorage.getItem(CHAVE_ARQUIVADAS) === "1");
  }, []);

  function alternarMinhas() {
    setSomenteMinhas((atual) => {
      const novo = !atual;
      localStorage.setItem(CHAVE_MINHAS, novo ? "1" : "0");
      return novo;
    });
  }

  function mudarVisao(nova: Visao) {
    setVisao(nova);
    localStorage.setItem(CHAVE_VISAO, nova);
  }

  const carregar = useCallback(async () => {
    const [t, m, f, sessao] = await Promise.all([
      supabase
        .from("tarefas")
        .select(
          "id, titulo, descricao, escopo, frente_id, status, prioridade, prazo, inicio, local_entrega, subiu_git, issue_numero, observacoes, revisor_id, commit_confirmado_em, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, cor, unidade)",
        )
        .eq("arquivada", false)
        .order("prazo", { ascending: true, nullsFirst: false }),
      supabase
        .from("membros")
        .select("id, nome, papel, frente_id")
        .order("nome"),
      supabase.from("frentes").select("id, nome, cor, unidade").order("nome"),
      supabase.auth.getUser(),
    ]);

    setErroCarga(!!(t.error || m.error || f.error));
    if (t.error || m.error || f.error) {
      setCarregando(false);
      return;
    }
    const lista = (t.data ?? []) as unknown as Tarefa[];
    const agora = Date.now();
    setTarefas(
      lista.map((tarefa) => {
        const otimista = otimistas.current.get(tarefa.id);
        if (!otimista) return tarefa;
        if (tarefa.status === otimista.status || agora > otimista.ate) {
          otimistas.current.delete(tarefa.id);
          return tarefa;
        }
        return { ...tarefa, status: otimista.status };
      }),
    );
    setMembros((m.data ?? []) as Membro[]);
    setFrentes((f.data ?? []) as unknown as Frente[]);
    setMeuId(sessao.data.user?.id ?? null);
    setCarregando(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!verArquivadas) carregar();
  }, [carregar, verArquivadas]);

  useEffect(() => {
    if (verArquivadas) return;
    function agendarRecarga() {
      if (timerRecarga.current) clearTimeout(timerRecarga.current);
      timerRecarga.current = setTimeout(() => {
        timerRecarga.current = null;
        carregar();
      }, 250);
    }

    const canal = supabase
      .channel("quadro")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tarefas" },
        agendarRecarga,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tarefa_responsaveis" },
        agendarRecarga,
      )
      .subscribe();

    return () => {
      if (timerRecarga.current) clearTimeout(timerRecarga.current);
      supabase.removeChannel(canal);
    };
  }, [carregar, verArquivadas]); // eslint-disable-line react-hooks/exhaustive-deps

  async function mudarStatus(id: number, status: Status) {
    const anterior = tarefas.find((t) => t.id === id)?.status;
    if (anterior === status) return;

    otimistas.current.set(id, { status, ate: Date.now() + VALIDADE_OTIMISTA });
    setTarefas((atual) =>
      atual.map((t) => (t.id === id ? { ...t, status } : t)),
    );

    const { error } = await supabase
      .from("tarefas")
      .update({ status })
      .eq("id", id);
    if (error) {
      otimistas.current.delete(id);
      if (anterior) {
        setTarefas((atual) =>
          atual.map((t) => (t.id === id ? { ...t, status: anterior } : t)),
        );
      }
      avisar("Não deu pra mudar o status. Tenta de novo.");
    }
  }

  function pedirArquivamento(id: number) {
    const t = tarefas.find((x) => x.id === id);
    if (t) setArquivando(t);
  }

  async function arquivar(t: Tarefa) {
    setExecutandoArquivo(true);
    const { error } = await supabase
      .from("tarefas")
      .update({ arquivada: true })
      .eq("id", t.id);
    setExecutandoArquivo(false);
    setArquivando(null);
    if (error) {
      avisar("Não deu pra arquivar. Tenta de novo.");
      return;
    }
    setTarefas((atual) => atual.filter((x) => x.id !== t.id));
  }

  function alternarColuna(chave: string) {
    setExpandidas((atual) => {
      const nova = new Set(atual);
      if (nova.has(chave)) nova.delete(chave);
      else nova.add(chave);
      return nova;
    });
  }

  const filtrarPorCampos = useCallback(
    (t: Tarefa) => {
      const buscaLimpa = busca.trim().toLowerCase();
      const responsaveis = responsaveisDe(t);
      if (buscaLimpa && !t.titulo.toLowerCase().includes(buscaLimpa))
        return false;
      if (
        filtroResponsavel &&
        !responsaveis.some((m) => m.id === filtroResponsavel)
      )
        return false;
      if (filtroPrioridade && t.prioridade !== filtroPrioridade) return false;
      if (filtroFrente && String(t.frente_id ?? "") !== filtroFrente)
        return false;
      if (somenteMinhas && !responsaveis.some((m) => m.id === meuId))
        return false;
      return true;
    },
    [
      busca,
      filtroResponsavel,
      filtroPrioridade,
      filtroFrente,
      somenteMinhas,
      meuId,
    ],
  );

  const filtrarTarefa = useCallback(
    (t: Tarefa) => t.escopo === visao && filtrarPorCampos(t),
    [visao, filtrarPorCampos],
  );

  const contagemPorEscopo = useMemo(() => {
    let individual = 0;
    let frente = 0;
    tarefas.forEach((t) => {
      if (!filtrarPorCampos(t)) return;
      if (t.escopo === "individual") individual += 1;
      else frente += 1;
    });
    return { individual, frente };
  }, [tarefas, filtrarPorCampos]);

  const visiveis = useMemo(
    () => tarefas.filter(filtrarTarefa),
    [tarefas, filtrarTarefa],
  );

  const grupos = useMemo(() => {
    if (!agrupar)
      return visiveis.length
        ? [{ chave: "todas", titulo: "Tarefas", itens: visiveis }]
        : [];
    if (visao === "frente") {
      return frentes
        .map((f) => ({
          chave: String(f.id),
          titulo: f.nome,
          itens: visiveis.filter((t) => t.frente_id === f.id),
        }))
        .filter((g) => g.itens.length > 0);
    }
    const porPessoa = new Map<
      string,
      { chave: string; titulo: string; itens: Tarefa[] }
    >();
    visiveis.forEach((t) => {
      const responsavel = responsaveisDe(t)[0];
      const chave = responsavel?.id ?? "sem-dono";
      const titulo = responsavel?.nome ?? "Sem dono";
      if (!porPessoa.has(chave))
        porPessoa.set(chave, { chave, titulo, itens: [] });
      porPessoa.get(chave)!.itens.push(t);
    });
    return Array.from(porPessoa.values()).sort((a, b) =>
      a.titulo.localeCompare(b.titulo),
    );
  }, [visao, visiveis, frentes, agrupar]);

  /** Setas circulam entre as abas, como manda o padrão de tablist. */
  function teclasDaAba(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (
      e.key !== "ArrowRight" &&
      e.key !== "ArrowLeft" &&
      e.key !== "Home" &&
      e.key !== "End"
    )
      return;
    e.preventDefault();
    const i = VISOES.indexOf(visao);
    const proxima =
      e.key === "Home"
        ? VISOES[0]
        : e.key === "End"
          ? VISOES[VISOES.length - 1]
          : e.key === "ArrowRight"
            ? VISOES[(i + 1) % VISOES.length]
            : VISOES[(i - 1 + VISOES.length) % VISOES.length];
    mudarVisao(proxima);
    document.getElementById(`aba-${proxima}`)?.focus();
  }

  const temFiltrosAtivos = !!(
    busca ||
    filtroResponsavel ||
    filtroPrioridade ||
    filtroFrente ||
    somenteMinhas ||
    verArquivadas
  );

  return (
    <div>
      <CabecalhoPagina
        categoria="Ciclo diário"
        icone={<IconeQuadro className="h-3.5 w-3.5 text-musgo" />}
        titulo="Quadro de tarefas"
        contagem={
          !carregando && !verArquivadas
            ? `${visiveis.length} na visão`
            : undefined
        }
        descricao="Organize o trabalho entre tarefas individuais e tarefas conjuntas de cada frente, em tempo real."
        acoes={
          <>
            <Botao variante="destaque" onClick={abrir}>
              <IconeMais className="h-4 w-4" />
              Nova tarefa{" "}
              <kbd className="rounded bg-tinta/15 px-1.5 py-0.5 font-mono text-xs">
                N
              </kbd>
            </Botao>
            <Link href="/publicar" className="botao botao-secundario">
              <IconeLote className="h-4 w-4 text-musgo" />
              Publicar em lote
            </Link>
          </>
        }
      />

      {/* Seletor de escopo + faixa explicativa dinâmica */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Escopo das tarefas"
          className="flex w-full gap-1 rounded-xl border border-linha bg-casca p-1 sm:w-fit"
        >
          {VISOES.map((v) => {
            const ativa = visao === v;
            const total =
              v === "individual"
                ? contagemPorEscopo.individual
                : contagemPorEscopo.frente;
            return (
              <button
                key={v}
                id={`aba-${v}`}
                role="tab"
                aria-selected={ativa}
                aria-controls="painel-quadro"
                tabIndex={ativa ? 0 : -1}
                onClick={() => mudarVisao(v)}
                onKeyDown={teclasDaAba}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-micro ease-entrada sm:flex-none ${
                  ativa
                    ? "bg-papel text-tinta shadow-cartao"
                    : "text-tinta/70 hover:bg-papel/50 hover:text-tinta"
                }`}
              >
                {v === "individual" ? (
                  <IconeUsuario className="h-4 w-4 text-musgo" />
                ) : (
                  <IconeFrentes className="h-4 w-4 text-ferro" />
                )}
                <span>{v === "individual" ? "Individuais" : "Da frente"}</span>
                {!carregando && !verArquivadas && (
                  <span className="rounded-full border border-linha bg-campo px-2 py-0.5 font-mono text-xs text-tinta">
                    {total}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-linha border-l-4 border-l-musgo bg-papel/85 px-4 py-2.5 text-xs text-tinta/70 shadow-cartao">
        {visao === "individual" ? (
          <span>
            <strong className="text-tinta">Visão Individual:</strong> tarefas
            com até 1 responsável. A frente (quando escolhida) indica apenas a
            matéria do PI.
          </span>
        ) : (
          <span>
            <strong className="text-tinta">Visão Da frente:</strong> tarefas
            conjuntas em que o banco atribui automaticamente todos os
            integrantes da frente.
          </span>
        )}
      </div>

      {/* Busca e filtros rápidos */}
      <div className="cartao mt-4 p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta/70" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar tarefa por título…"
              aria-label="Buscar tarefa por título"
              className="campo pl-9"
            />
          </div>

          <button
            type="button"
            onClick={alternarMinhas}
            aria-pressed={somenteMinhas}
            className={`botao min-h-10 px-3 py-1.5 text-xs ${
              somenteMinhas ? "botao-primario" : "botao-secundario"
            }`}
          >
            <IconeUsuario className="h-3.5 w-3.5" />
            Minhas tarefas
          </button>

          <button
            type="button"
            onClick={() => {
              setVerArquivadas((atual) => {
                const novo = !atual;
                localStorage.setItem(CHAVE_ARQUIVADAS, novo ? "1" : "0");
                return novo;
              });
            }}
            aria-pressed={verArquivadas}
            className={`botao min-h-10 px-3 py-1.5 text-xs ${
              verArquivadas ? "botao-primario" : "botao-secundario"
            }`}
          >
            <IconeArquivo className="h-3.5 w-3.5" />
            Arquivadas
          </button>

          {temFiltrosAtivos && (
            <Botao
              variante="discreto"
              className="text-xs"
              onClick={() => {
                setBusca("");
                setFiltroResponsavel("");
                setFiltroPrioridade("");
                setFiltroFrente("");
                setSomenteMinhas(false);
                setVerArquivadas(false);
                localStorage.setItem(CHAVE_ARQUIVADAS, "0");
                localStorage.setItem(CHAVE_MINHAS, "0");
              }}
            >
              Limpar filtros
            </Botao>
          )}
        </div>

        <details className="mt-2.5 border-t border-linha/80 pt-2">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 py-1 text-xs font-semibold text-tinta/70 hover:text-tinta">
            <IconeFiltro className="h-3.5 w-3.5" />
            Mais filtros (responsável, prioridade, frente)
            {filtroResponsavel || filtroPrioridade || filtroFrente
              ? " · ativos"
              : ""}
          </summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <select
              value={filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
              aria-label="Filtrar por responsável"
              className="campo py-2 text-xs"
            >
              <option value="">Todo mundo</option>
              {membros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
            <select
              value={filtroPrioridade}
              onChange={(e) => setFiltroPrioridade(e.target.value)}
              aria-label="Filtrar por prioridade"
              className="campo py-2 text-xs"
            >
              <option value="">Toda prioridade</option>
              {PRIORIDADES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <select
              value={filtroFrente}
              onChange={(e) => setFiltroFrente(e.target.value)}
              aria-label="Filtrar por frente"
              className="campo py-2 text-xs"
            >
              <option value="">Toda frente</option>
              {frentes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
        </details>
      </div>

      {!verArquivadas && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-linha bg-papel/85 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <div
              aria-label="Formato das tarefas"
              className="flex gap-1 rounded-lg border border-linha bg-casca p-0.5"
            >
              {[
                {
                  id: "quadro",
                  rotulo: "Quadro",
                  icone: <IconeQuadro className="h-3.5 w-3.5" />,
                },
                {
                  id: "lista",
                  rotulo: "Lista",
                  icone: <IconeLista className="h-3.5 w-3.5" />,
                },
              ].map((opcao) => (
                <button
                  key={opcao.id}
                  type="button"
                  aria-pressed={formato === opcao.id}
                  onClick={() => {
                    setFormato(opcao.id);
                    localStorage.setItem("pi-quadro-formato", opcao.id);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors duration-micro ease-entrada ${
                    formato === opcao.id
                      ? "bg-papel text-tinta shadow-cartao"
                      : "text-tinta/70 hover:text-tinta"
                  }`}
                >
                  {opcao.icone}
                  {opcao.rotulo}
                </button>
              ))}
            </div>

            {formato === "quadro" && (
              <p className="hidden items-center gap-1.5 text-xs text-tinta/70 md:flex">
                <IconeDica className="h-3.5 w-3.5 text-broto" />
                Arraste cartões entre colunas ou clique para abrir detalhes,
                checklist e entrega.
              </p>
            )}
          </div>

          {formato === "quadro" && (
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-tinta">
              <input
                type="checkbox"
                checked={agrupar}
                onChange={(e) => {
                  setAgrupar(e.target.checked);
                  localStorage.setItem(
                    "pi-quadro-agrupar",
                    e.target.checked ? "1" : "0",
                  );
                }}
              />
              Agrupar por {visao === "frente" ? "frente" : "pessoa"}
            </label>
          )}
        </div>
      )}

      {erroCarga && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-trigo bg-trigo/15 p-4 text-sm text-tinta"
        >
          <span>Não foi possível carregar as tarefas.</span>
          <Botao variante="secundario" onClick={carregar}>
            Tentar novamente
          </Botao>
        </div>
      )}

      <div
        id="painel-quadro"
        role="tabpanel"
        aria-labelledby={`aba-${visao}`}
        tabIndex={-1}
      >
        {verArquivadas ? (
          <ListaArquivadas
            escopo={visao}
            aoRestaurar={carregar}
            filtrarTarefa={filtrarTarefa}
          />
        ) : carregando ? (
          <p className="mt-10 text-sm text-tinta/70">Carregando tarefas…</p>
        ) : erroCarga ? null : grupos.length === 0 ? (
          <div className="cartao mt-6 p-8 text-center text-sm text-tinta/70">
            {busca ||
            filtroResponsavel ||
            filtroPrioridade ||
            filtroFrente ||
            somenteMinhas
              ? "Nenhuma tarefa corresponde aos filtros escolhidos."
              : visao === "frente"
                ? "Nenhuma tarefa de frente por aqui ainda."
                : "Nenhuma tarefa individual por aqui ainda."}
          </div>
        ) : formato === "lista" ? (
          <div className="cartao mt-4 overflow-hidden">
            {visiveis.map((t) => (
              <LinhaTarefa
                key={t.id}
                tarefa={t}
                mostrarStatus
                aoAtualizar={carregar}
                membros={membros}
                frentes={frentes}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {grupos.map((g) => (
              <section key={g.chave} aria-labelledby={`grupo-${g.chave}`}>
                <h2
                  id={`grupo-${g.chave}`}
                  className={
                    agrupar
                      ? "mb-3 flex items-center gap-2 font-display text-lg font-bold text-tinta"
                      : "sr-only"
                  }
                >
                  <span>{g.titulo}</span>
                  <span className="rounded-full border border-linha bg-casca px-2 py-0.5 font-mono text-xs font-semibold text-tinta">
                    {g.itens.length}
                  </span>
                </h2>
                <QuadroTarefas
                  grupo={g.chave}
                  nomeDoGrupo={g.titulo}
                  tarefas={g.itens}
                  expandidas={expandidas}
                  aoAlternarColuna={alternarColuna}
                  aoMudarStatus={mudarStatus}
                  aoArquivar={pedirArquivamento}
                  aoAtualizar={carregar}
                  membros={membros}
                  frentes={frentes}
                />
              </section>
            ))}
          </div>
        )}
      </div>

      {arquivando && (
        <ConfirmarAcao
          titulo="Arquivar esta tarefa?"
          descricao={
            <>
              <strong className="font-semibold text-tinta">
                {arquivando.titulo}
              </strong>{" "}
              sai do quadro, do calendário, da Semana e do painel da frente, e
              passa a aparecer no filtro “arquivadas”. Nada é apagado: o
              histórico dela continua na Trilha, e dá para restaurar quando
              quiser.
            </>
          }
          rotuloConfirmar="Arquivar"
          executando={executandoArquivo}
          aoConfirmar={() => arquivar(arquivando)}
          aoCancelar={() => setArquivando(null)}
        />
      )}
    </div>
  );
}
