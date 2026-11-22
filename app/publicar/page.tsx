"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { validar } from "@/lib/contrato-tarefa.mjs";
import { resolverPorNome } from "@/lib/nomes.mjs";
import { lerLocalEntrega } from "@/lib/links";
import { progressoCriterios } from "@/lib/criterios";
import type { Frente, Membro } from "@/lib/types";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Botao from "@/components/ui/Botao";
import {
  IconeAlerta,
  IconeCheck,
  IconeLote,
} from "@/components/ui/Icones";

/** Uma tarefa do objeto de handoff — ver docs/CONTRATO-TAREFA.md, seção D. */
type Rascunho = {
  titulo?: string;
  descricao?: string | null;
  escopo?: string;
  frente?: string | null;
  responsavel?: string | null;
  revisor?: string | null;
  prioridade?: string;
  prazo?: string | null;
  local_entrega?: string | null;
  issue_numero?: number | null;
  observacoes?: string | null;
};

type Resultado =
  | { estado: "criada"; id: number; titulo: string; atribuidos: string[] }
  | { estado: "falhou"; titulo: string; erro: string }
  | { estado: "nao-tentada"; titulo: string };

const EXEMPLO = `[
  {
    "titulo": "Implementar conversão entre bases numéricas",
    "descricao": "Converter entre bases 2, 8, 10 e 16.\\n\\n- [ ] Função de conversão\\n- [ ] Testes de borda",
    "escopo": "individual",
    "frente": "Lógica de Programação",
    "responsavel": "João Hélio",
    "prioridade": "alta",
    "prazo": "2026-09-19"
  }
]`;

const PASSOS = [
  { num: "1", titulo: "Cole ou suba o JSON", texto: "Envie um arquivo .json ou cole uma lista de tarefas." },
  { num: "2", titulo: "Validação automática", texto: "Nomes de frentes, integrantes e prazos são conferidos antes." },
  { num: "3", titulo: "Publicação em lote", texto: "Tudo entra no Quadro e na Trilha com sua autoria." },
];

export default function Publicar() {
  const [texto, setTexto] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [origem, setOrigem] = useState<string | null>(null);
  const campoArquivo = useRef<HTMLInputElement>(null);

  const supabase = criarClienteNavegador();

  useEffect(() => {
    Promise.all([
      supabase.from("frentes").select("id, nome, unidade").order("nome"),
      supabase.from("membros").select("id, nome, frente_id").order("nome"),
      supabase.auth.getUser(),
    ])
      .then(([f, m, sessao]) => {
        if (f.error || m.error) {
          setErroCarga((f.error ?? m.error)!.message);
        } else {
          setFrentes((f.data ?? []) as unknown as Frente[]);
          setMembros((m.data ?? []) as Membro[]);
          setMeuId(sessao.data.user?.id ?? null);
        }
        setCarregando(false);
      })
      .catch((e) => {
        setErroCarga(e instanceof Error ? e.message : String(e));
        setCarregando(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const analise = useMemo(() => {
    const cru = texto.trim();
    if (!cru) return null;

    let dados: unknown;
    try {
      dados = JSON.parse(cru);
    } catch (e) {
      return {
        erroDeFormato: `O texto não é JSON válido: ${(e as Error).message}. Confira vírgulas e aspas.`,
        aguardando: false,
        tarefas: [] as Rascunho[],
        erros: [] as string[],
      };
    }

    const tarefas = (Array.isArray(dados) ? dados : [dados]) as Rascunho[];
    if (tarefas.length === 0) {
      return {
        erroDeFormato: "A lista está vazia — não há nada para publicar.",
        tarefas,
        erros: [],
        aguardando: false,
      };
    }

    if (carregando || erroCarga)
      return {
        erroDeFormato: null,
        tarefas,
        erros: [] as string[],
        aguardando: true,
      };

    const erros = tarefas.flatMap((t, i) => validar(t, i, { frentes, membros }));
    return { erroDeFormato: null, tarefas, erros, aguardando: false };
  }, [texto, frentes, membros, carregando, erroCarga]);

  const previa = useMemo(() => {
    if (!analise || analise.erroDeFormato || analise.aguardando) return [];
    return analise.tarefas.map((t) => {
      const frente = t.frente
        ? resolverPorNome(t.frente, frentes, (f: Frente) => f.nome)
        : null;
      const resp = t.responsavel
        ? resolverPorNome(t.responsavel, membros, (m: Membro) => m.nome)
        : null;
      const rev = t.revisor
        ? resolverPorNome(t.revisor, membros, (m: Membro) => m.nome)
        : null;
      const frenteOk = frente && frente.ok ? frente.item : null;

      const daFrente =
        t.escopo === "frente" && frenteOk
          ? membros.filter((m) => m.frente_id === frenteOk.id)
          : [];

      return {
        titulo: t.titulo ?? "(sem título)",
        escopo: t.escopo,
        frente: frenteOk,
        responsavel: resp && resp.ok ? resp.item : null,
        revisor: rev && rev.ok ? rev.item : null,
        atribuidos: daFrente,
        frenteVazia:
          t.escopo === "frente" && !!frenteOk && daFrente.length === 0,
        prioridade: t.prioridade ?? "media",
        prazo: t.prazo ?? null,
        local: lerLocalEntrega(t.local_entrega),
        criterios: progressoCriterios(t.descricao),
      };
    });
  }, [analise, frentes, membros]);

  const frentesVazias = previa.filter((p) => p.frenteVazia);
  const podePublicar =
    !!analise &&
    !analise.erroDeFormato &&
    analise.erros.length === 0 &&
    frentesVazias.length === 0 &&
    !!meuId &&
    !publicando &&
    !erroCarga;

  function lerArquivo(arquivo: File) {
    setResultados(null);
    const leitor = new FileReader();
    leitor.onload = () => {
      setTexto(String(leitor.result ?? ""));
      setNomeArquivo(arquivo.name);
    };
    leitor.onerror = () => {
      setNomeArquivo(null);
      setTexto("");
      alert(
        `Não deu pra ler "${arquivo.name}". Tente colar o conteúdo no campo abaixo.`,
      );
    };
    leitor.readAsText(arquivo);
  }

  async function publicar() {
    if (!analise || !meuId) return;
    setPublicando(true);
    setOrigem(nomeArquivo ?? "texto colado");

    const saida: Resultado[] = [];
    const lista = analise.tarefas;

    for (let i = 0; i < lista.length; i++) {
      const t = lista[i];
      const p = previa[i];

      const { data: criada, error } = await supabase
        .from("tarefas")
        .insert({
          titulo: (t.titulo ?? "").trim(),
          descricao: t.descricao?.trim() || null,
          criador_id: meuId,
          escopo: t.escopo,
          frente_id: p.frente ? p.frente.id : null,
          revisor_id: p.revisor ? p.revisor.id : null,
          prioridade: t.prioridade ?? "media",
          prazo: t.prazo ?? null,
          local_entrega: t.local_entrega?.trim() || null,
          issue_numero: t.issue_numero ?? null,
          observacoes: t.observacoes?.trim() || null,
        })
        .select("id")
        .single();

      if (error || !criada) {
        saida.push({
          estado: "falhou",
          titulo: p.titulo,
          erro: error?.message ?? "erro desconhecido",
        });
        for (let j = i + 1; j < lista.length; j++) {
          saida.push({ estado: "nao-tentada", titulo: previa[j].titulo });
        }
        break;
      }

      if (t.escopo === "individual" && p.responsavel) {
        await supabase
          .from("tarefa_responsaveis")
          .insert({ tarefa_id: criada.id, membro_id: p.responsavel.id });
      }

      const { data: reais } = await supabase
        .from("tarefa_responsaveis")
        .select("membro:membros(nome)")
        .eq("tarefa_id", criada.id);

      saida.push({
        estado: "criada",
        id: criada.id,
        titulo: p.titulo,
        atribuidos: (
          (reais ?? []) as unknown as { membro: { nome: string } | null }[]
        )
          .map((r) => r.membro?.nome)
          .filter(Boolean) as string[],
      });
    }

    setResultados(saida);
    setPublicando(false);
  }

  const criadas = resultados?.filter((r) => r.estado === "criada") ?? [];
  const falhou = resultados?.find((r) => r.estado === "falhou");
  const naoTentadas =
    resultados?.filter((r) => r.estado === "nao-tentada") ?? [];

  return (
    <div>
      <CabecalhoPagina
        voltar={{ href: "/tarefas", rotulo: "Quadro" }}
        categoria="Importação de tarefas"
        icone={<IconeLote className="h-3.5 w-3.5 text-musgo" />}
        titulo="Publicar em lote"
        descricao={
          <>
            Cole ou suba um arquivo JSON seguindo o{" "}
            <a
              href="https://github.com/joaohelio-feob/apppi/blob/main/docs/CONTRATO-TAREFA.md"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-musgo underline underline-offset-4 hover:text-tinta"
            >
              contrato de tarefa
            </a>
            .
          </>
        }
      />

      {/* Barra didática de 3 passos */}
      <ol className="mb-6 grid gap-3 sm:grid-cols-3">
        {PASSOS.map((p) => (
          <li key={p.num} className="cartao flex items-start gap-3 p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-musgo font-mono text-xs font-bold text-campo">
              {p.num}
            </span>
            <div>
              <p className="font-display text-sm font-bold text-tinta">
                {p.titulo}
              </p>
              <p className="mt-0.5 text-xs text-tinta/70">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>

      {resultados && (
        <section aria-labelledby="res" className="cartao p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha pb-3">
            <h2 id="res" className="font-display text-lg font-bold text-tinta">
              {criadas.length} de {resultados.length} publicadas
              {origem && (
                <span className="ml-2 font-mono text-xs font-normal text-tinta/70">
                  de {origem}
                </span>
              )}
            </h2>
            <Botao
              variante="secundario"
              onClick={() => {
                setResultados(null);
                setTexto("");
                setNomeArquivo(null);
              }}
            >
              Publicar outro lote
            </Botao>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <h3 className="flex items-center gap-1.5 font-display text-xs font-bold uppercase text-musgo">
                <IconeCheck className="h-3.5 w-3.5" />
                Criadas · {criadas.length}
              </h3>
              {criadas.length === 0 ? (
                <p className="mt-1 text-sm text-tinta/70">nenhuma.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {criadas.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-linha/80 bg-campo/50 px-3 py-2 text-sm"
                    >
                      <Link
                        href="/tarefas"
                        className="font-semibold text-tinta underline underline-offset-4 hover:text-musgo"
                      >
                        {r.titulo}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-tinta/70">
                        #{r.id} ·{" "}
                        {r.atribuidos.length > 0
                          ? r.atribuidos.join(", ")
                          : "sem responsável"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {falhou && (
              <div className="rounded-xl border border-trigo bg-trigo/15 p-3.5">
                <h3 className="flex items-center gap-1.5 font-display text-xs font-bold uppercase text-tinta">
                  <IconeAlerta className="h-3.5 w-3.5" />
                  Falhou · 1
                </h3>
                <p className="mt-1 text-sm font-semibold text-tinta">
                  {falhou.titulo}
                </p>
                <p className="mt-0.5 text-xs text-tinta/70">{falhou.erro}</p>
              </div>
            )}

            {naoTentadas.length > 0 && (
              <div className="rounded-xl border border-linha bg-campo/60 p-3.5">
                <h3 className="font-display text-xs font-bold uppercase text-tinta/70">
                  Não tentadas · {naoTentadas.length}
                </h3>
                <p className="mt-1 text-xs text-tinta/70">
                  Pare aqui: reenvie só estas, sem as já criadas, para não
                  duplicar.
                </p>
                <ul className="mt-2 space-y-1">
                  {naoTentadas.map((r, i) => (
                    <li key={i} className="text-sm text-tinta">
                      {r.titulo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {!resultados && (
        <div className="space-y-5">
          <div className="cartao p-5">
            <div className="flex flex-wrap items-center gap-3">
              <label className="botao botao-secundario cursor-pointer">
                Escolher arquivo .json
                <input
                  ref={campoArquivo}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(e) => {
                    const a = e.target.files?.[0];
                    if (a) lerArquivo(a);
                    e.target.value = "";
                  }}
                />
              </label>
              {nomeArquivo && (
                <span className="rounded-full border border-linha bg-casca px-3 py-1 font-mono text-xs text-tinta">
                  {nomeArquivo}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setTexto(EXEMPLO);
                  setNomeArquivo(null);
                }}
                className="text-xs font-semibold text-musgo underline underline-offset-4 hover:text-tinta"
              >
                Preencher com exemplo
              </button>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-tinta/70">
                JSON da tarefa ou lista de tarefas
              </span>
              <textarea
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  setNomeArquivo(null);
                }}
                rows={10}
                spellCheck={false}
                placeholder={'[\n  { "titulo": "…", "escopo": "individual" }\n]'}
                className="campo mt-1.5 font-mono text-xs"
              />
            </label>

            {carregando && (
              <p className="mt-3 text-sm text-tinta/70">
                Carregando frentes e integrantes… a conferência dos nomes
                começa quando elas chegarem.
              </p>
            )}

            {erroCarga && (
              <p className="mt-3 rounded-xl border border-trigo bg-trigo/15 p-3.5 text-sm text-tinta">
                Não deu pra carregar frentes e integrantes: {erroCarga}. Sem
                essas listas não há como validar os nomes do lote, então a
                publicação fica bloqueada. Recarregue a página; se persistir,
                confira a conexão.
              </p>
            )}

            {!texto.trim() && !carregando && !erroCarga && (
              <p className="mt-3 text-xs text-tinta/70">
                Nada colado ainda. Suba um arquivo, cole o JSON, ou clique em
                “Preencher com exemplo”.
              </p>
            )}
          </div>

          {analise?.erroDeFormato && (
            <p className="rounded-xl border border-trigo bg-trigo/15 px-4 py-3 text-sm text-tinta">
              {analise.erroDeFormato}
            </p>
          )}

          {analise && !analise.erroDeFormato && analise.erros.length > 0 && (
            <section
              aria-labelledby="err"
              className="cartao border-l-4 border-l-trigo p-5"
            >
              <h2 id="err" className="font-display text-lg font-bold text-tinta">
                {analise.erros.length}{" "}
                {analise.erros.length === 1 ? "problema" : "problemas"} — nada
                foi criado
              </h2>
              <p className="mt-1 text-sm text-tinta/70">
                O lote inteiro é recusado de propósito: não existe exclusão de
                tarefa, então não há como desfazer uma criada por engano.
              </p>
              <ul className="mt-3 space-y-1.5">
                {analise.erros.map((e, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-trigo/15 px-3 py-1.5 text-sm text-tinta"
                  >
                    {e}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {analise &&
            !analise.erroDeFormato &&
            analise.erros.length === 0 &&
            previa.length > 0 && (
              <section aria-labelledby="prev" className="cartao p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha pb-3">
                  <h2
                    id="prev"
                    className="font-display text-lg font-bold text-tinta"
                  >
                    {previa.length === 1
                      ? "1 tarefa pronta para publicar"
                      : `${previa.length} tarefas prontas para publicar`}
                  </h2>
                  <Botao
                    variante="destaque"
                    onClick={publicar}
                    disabled={!podePublicar}
                  >
                    {publicando
                      ? "Publicando…"
                      : `Publicar ${previa.length === 1 ? "1 tarefa" : `${previa.length} tarefas`}`}
                  </Botao>
                </div>

                {frentesVazias.length > 0 && (
                  <p className="mt-3 rounded-xl border border-trigo bg-trigo/15 px-3.5 py-2.5 text-sm text-tinta">
                    {frentesVazias.map((p) => p.frente?.nome).join(", ")} não tem
                    nenhum integrante. O banco recusaria a tarefa de frente,
                    então corrija antes de publicar.
                  </p>
                )}

                <div className="mt-4 divide-y divide-linha/80 rounded-xl border border-linha bg-campo/40">
                  {previa.map((p, i) => (
                    <div key={i} className="px-4 py-3">
                      <p className="font-semibold text-tinta">{p.titulo}</p>
                      <p className="mt-1 text-xs text-tinta/70">
                        {p.escopo === "frente" ? (
                          <>
                            frente {p.frente?.nome} ·{" "}
                            {p.atribuidos.length > 0 ? (
                              <>
                                o trigger vai atribuir {p.atribuidos.length}:{" "}
                                <span className="font-medium text-tinta">
                                  {p.atribuidos.map((m) => m.nome).join(", ")}
                                </span>
                              </>
                            ) : (
                              <span className="text-tinta">
                                frente sem integrantes
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            {p.responsavel ? p.responsavel.nome : "sem dono"}
                            {p.frente && <> · frente {p.frente.nome}</>}
                          </>
                        )}
                        {p.revisor ? (
                          <> · revisor {p.revisor.nome}</>
                        ) : (
                          <> · sem revisor, conclui na entrega</>
                        )}
                        {p.prazo && (
                          <>
                            {" "}
                            · <span className="font-mono">{p.prazo}</span>
                          </>
                        )}
                        {" · "}prioridade {p.prioridade}
                        {p.criterios && (
                          <>
                            {" "}
                            ·{" "}
                            <span className="font-mono">
                              {p.criterios.feitos}/{p.criterios.total}
                            </span>{" "}
                            critérios
                          </>
                        )}
                        {p.local && p.local.tipo === "texto" && (
                          <> · local de entrega vira anotação, não link</>
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                {!meuId && (
                  <p className="mt-3 text-sm text-tinta/70">
                    Sem sessão não dá pra publicar — as tarefas ficariam sem
                    autor na Trilha.
                  </p>
                )}
              </section>
            )}
        </div>
      )}
    </div>
  );
}
