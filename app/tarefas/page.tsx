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
import ListaArquivadas from "@/components/ListaArquivadas";
import ConfirmarAcao from "@/components/ConfirmarAcao";
import { useNovaTarefa } from "@/components/NovaTarefaProvider";
import { useToast } from "@/components/ToastProvider";

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
  /** Arquivadas é filtro de ESTADO, eixo diferente do escopo — por isso é um
   *  controle à parte, e não uma terceira aba do tablist de escopo. */
  const [verArquivadas, setVerArquivadas] = useState(false);
  const [arquivando, setArquivando] = useState<Tarefa | null>(null);
  const [executandoArquivo, setExecutandoArquivo] = useState(false);

  /**
   * Colunas expandidas ("ver mais"), por chave estável `grupo::status` — nunca
   * por índice, porque o refetch do realtime reordena e remonta a lista. É o
   * que impede a coluna de colapsar sozinha embaixo de quem está lendo.
   */
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  /**
   * Mudanças de status já aplicadas na tela e ainda não confirmadas pelo
   * servidor. O realtime refaz a consulta inteira a cada evento — inclusive
   * eventos de outras pessoas — e uma consulta que parta antes do nosso UPDATE
   * commitar voltaria com o status antigo e desfaria o que o usuário acabou de
   * fazer. Reaplicar por cima resolve sem piscar; a entrada morre quando o
   * servidor concorda ou quando o prazo expira.
   */
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

  // Atualização ao vivo: se um colega mexer, seu quadro acompanha. Uma ação só
  // pode disparar vários eventos (entregar mexe em tarefas duas vezes por
  // trigger), então os eventos são juntados numa recarga só.
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

  const filtrarTarefa = useCallback(
    (t: Tarefa) => {
      const buscaLimpa = busca.trim().toLowerCase();
      const responsaveis = responsaveisDe(t);
      if (t.escopo !== visao) return false;
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
      visao,
      busca,
      filtroResponsavel,
      filtroPrioridade,
      filtroFrente,
      somenteMinhas,
      meuId,
    ],
  );

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

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        {/* Título e volume numa faixa só. A sobrancelha em mono maiúsculo
            gastava uma faixa para dizer "Quadro", que a navegação já diz. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Quadro de tarefas
          </h1>
          {!carregando && !verArquivadas && (
            <p className="text-sm text-tinta/70">
              <span className="font-mono">{visiveis.length}</span> na visão
            </p>
          )}
        </div>
        {/* Criar é ação do quadro, então "em lote" mora aqui e não na
            navegação: /publicar é a mesma intenção em outro volume. */}
        <div className="flex items-center gap-3">
          <Botao onClick={abrir}>
            + Nova tarefa <kbd className="font-mono text-xs">N</kbd>
          </Botao>
          <Link
            href="/publicar"
            className="text-sm text-tinta/70 underline underline-offset-4 transition-colors duration-micro ease-entrada hover:text-tinta"
          >
            em lote
          </Link>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Escopo das tarefas"
        className="mt-6 flex gap-1 border border-linha bg-casca p-1 sm:w-fit"
      >
        {VISOES.map((v) => {
          const ativa = visao === v;
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
              className={`flex-1 px-4 py-1.5 text-sm transition-colors duration-micro ease-entrada sm:flex-none ${
                ativa
                  ? "bg-campo font-semibold text-tinta shadow-sm"
                  : "text-tinta/70 hover:bg-campo/60"
              }`}
            >
              {v === "individual" ? "Individuais" : "Da frente"}
            </button>
          );
        })}
      </div>

      {/* Cinco controles com o mesmo peso não dizem por onde começar. Busca
          fica sozinha na primeira faixa; os quatro filtros descem para a
          segunda, menores e sem caixa alta. */}
      <div className="mt-4">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por título…"
          aria-label="Buscar tarefa por título"
          className="w-full border border-linha bg-casca px-3 py-2 text-sm transition-colors duration-micro ease-entrada focus:border-musgo focus:outline-none"
        />
      </div>

      <details className="mt-2 border-b border-linha pb-2">
        <summary className="cursor-pointer py-2 text-sm font-medium">
          Filtros
          {filtroResponsavel ||
          filtroPrioridade ||
          filtroFrente ||
          somenteMinhas ||
          verArquivadas
            ? " · ativos"
            : ""}
        </summary>
        <div className="flex flex-wrap items-center gap-2 py-2">
          <select
            value={filtroResponsavel}
            onChange={(e) => setFiltroResponsavel(e.target.value)}
            aria-label="Filtrar por responsável"
            className="border border-linha bg-casca px-2 py-1.5 text-xs text-tinta/70"
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
            className="border border-linha bg-casca px-2 py-1.5 text-xs text-tinta/70"
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
            className="border border-linha bg-casca px-2 py-1.5 text-xs text-tinta/70"
          >
            <option value="">Toda frente</option>
            {frentes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setVerArquivadas((atual) => {
                const novo = !atual;
                localStorage.setItem(CHAVE_ARQUIVADAS, novo ? "1" : "0");
                return novo;
              });
            }}
            aria-pressed={verArquivadas}
            className={`border px-3 py-1.5 text-xs transition-colors duration-micro ease-entrada ${
              verArquivadas
                ? "border-tinta bg-tinta text-campo"
                : "border-linha text-tinta/70 hover:bg-casca"
            }`}
          >
            arquivadas
          </button>
          <button
            onClick={alternarMinhas}
            aria-pressed={somenteMinhas}
            className={`border px-3 py-1.5 text-xs transition-colors duration-micro ease-entrada ${
              somenteMinhas
                ? "border-tinta bg-tinta text-campo"
                : "border-linha text-tinta/70 hover:bg-casca"
            }`}
          >
            minhas tarefas
          </button>
        </div>
      </details>
      {(busca ||
        filtroResponsavel ||
        filtroPrioridade ||
        filtroFrente ||
        somenteMinhas ||
        verArquivadas) && (
        <Botao
          variante="discreto"
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

      {!verArquivadas && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-y border-linha py-2">
          <div aria-label="Formato das tarefas" className="flex gap-1">
            {["quadro", "lista"].map((opcao) => (
              <Botao
                key={opcao}
                variante={formato === opcao ? "primario" : "discreto"}
                aria-pressed={formato === opcao}
                onClick={() => {
                  setFormato(opcao);
                  localStorage.setItem("pi-quadro-formato", opcao);
                }}
              >
                {opcao === "quadro" ? "Quadro" : "Lista"}
              </Botao>
            ))}
          </div>
          {formato === "quadro" && (
            <label className="flex items-center gap-2 text-sm">
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
        <div role="alert" className="mt-4 border-l-2 border-trigo p-3 text-sm">
          Não foi possível carregar as tarefas.{" "}
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
          // Arquivada não se arrasta entre colunas de status, então aqui o
          // quadro dá lugar a uma lista. O eixo de escopo do tablist continua
          // valendo — a lista respeita a aba escolhida.
          <ListaArquivadas
            escopo={visao}
            aoRestaurar={carregar}
            filtrarTarefa={filtrarTarefa}
          />
        ) : carregando ? (
          <p className="mt-10 text-sm text-tinta/70">carregando…</p>
        ) : erroCarga ? null : grupos.length === 0 ? (
          <p className="mt-10 text-sm text-tinta/70">
            {busca ||
            filtroResponsavel ||
            filtroPrioridade ||
            filtroFrente ||
            somenteMinhas
              ? "Nenhuma tarefa corresponde aos filtros."
              : visao === "frente"
                ? "Nenhuma tarefa de frente por aqui."
                : "Nenhuma tarefa individual por aqui."}
          </p>
        ) : formato === "lista" ? (
          <div className="mt-4 border-t border-linha">
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
                      ? "mb-3 font-display text-lg font-semibold"
                      : "sr-only"
                  }
                >
                  {g.titulo}
                  <span className="ml-2 text-xs font-normal text-tinta/70">
                    · <span className="font-mono">{g.itens.length}</span>
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
