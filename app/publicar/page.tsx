"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { validar } from "@/lib/contrato-tarefa.mjs";
import { resolverPorNome } from "@/lib/nomes.mjs";
import { lerLocalEntrega } from "@/lib/links";
import { progressoCriterios } from "@/lib/criterios";
import type { Frente, Membro } from "@/lib/types";

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
    // Uma consulta só de cada, agrupada no cliente — a prévia precisa listar
    // os integrantes de cada frente, e uma consulta por frente do lote seria
    // desperdício.
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
      // Sem isto a promessa rejeitada deixava a página presa em "carregando"
      // para sempre — sem validar nome nenhum e sem dizer por quê.
      .catch((e) => {
        setErroCarga(e instanceof Error ? e.message : String(e));
        setCarregando(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Parse + validação de contrato. Nada aqui toca no banco. */
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
      return { erroDeFormato: "A lista está vazia — não há nada para publicar.", tarefas, erros: [], aguardando: false };
    }

    // Erro de formato aparece sempre — não depende de lista nenhuma. Já a
    // validação de contrato precisa de frentes e membros: rodá-la antes de as
    // consultas voltarem acusaria "não existe" em nome perfeitamente válido.
    if (carregando || erroCarga) return { erroDeFormato: null, tarefas, erros: [] as string[], aguardando: true };

    const erros = tarefas.flatMap((t, i) => validar(t, i, { frentes, membros }));
    return { erroDeFormato: null, tarefas, erros, aguardando: false };
  }, [texto, frentes, membros, carregando, erroCarga]);

  /** O que o banco vai fazer, não o que foi digitado. */
  const previa = useMemo(() => {
    if (!analise || analise.erroDeFormato || analise.aguardando) return [];
    return analise.tarefas.map((t) => {
      const frente = t.frente ? resolverPorNome(t.frente, frentes, (f: Frente) => f.nome) : null;
      const resp = t.responsavel ? resolverPorNome(t.responsavel, membros, (m: Membro) => m.nome) : null;
      const rev = t.revisor ? resolverPorNome(t.revisor, membros, (m: Membro) => m.nome) : null;
      const frenteOk = frente && frente.ok ? frente.item : null;

      // Tarefa de frente: quem responde é toda a frente, atribuída pelo
      // trigger. A prévia mostra esses nomes, não a ausência da chave.
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
        frenteVazia: t.escopo === "frente" && !!frenteOk && daFrente.length === 0,
        prioridade: t.prioridade ?? "media",
        prazo: t.prazo ?? null,
        local: lerLocalEntrega(t.local_entrega),
        criterios: progressoCriterios(t.descricao),
      };
    });
  }, [analise, frentes, membros]);

  const frentesVazias = previa.filter((p) => p.frenteVazia);
  const podePublicar =
    !!analise && !analise.erroDeFormato && analise.erros.length === 0 &&
    frentesVazias.length === 0 && !!meuId && !publicando && !erroCarga;

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
      alert(`Não deu pra ler "${arquivo.name}". Tente colar o conteúdo no campo abaixo.`);
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
          // Da sessão, nunca do objeto: autoria reivindicável quebraria a
          // Trilha (contrato B.1).
          criador_id: meuId,
          escopo: t.escopo,
          frente_id: p.frente ? p.frente.id : null,
          revisor_id: p.revisor ? p.revisor.id : null,
          prioridade: t.prioridade ?? "media",
          prazo: t.prazo ?? null,
          local_entrega: t.local_entrega?.trim() || null,
          issue_numero: t.issue_numero ?? null,
          observacoes: t.observacoes?.trim() || null,
          // status omitido: nasce 'pendente' (contrato B.2).
        })
        .select("id")
        .single();

      if (error || !criada) {
        // Para na falha: sem policy de DELETE não há rollback, e continuar
        // deixaria um lote meio publicado sem rastro de onde parou.
        saida.push({ estado: "falhou", titulo: p.titulo, erro: error?.message ?? "erro desconhecido" });
        for (let j = i + 1; j < lista.length; j++) {
          saida.push({ estado: "nao-tentada", titulo: previa[j].titulo });
        }
        break;
      }

      if (t.escopo === "individual" && p.responsavel) {
        await supabase.from("tarefa_responsaveis").insert({ tarefa_id: criada.id, membro_id: p.responsavel.id });
      }

      // Quem foi de fato atribuído pode diferir da prévia, se alguém entrou
      // na frente no meio. Relê do banco em vez de repetir a previsão.
      const { data: reais } = await supabase
        .from("tarefa_responsaveis")
        .select("membro:membros(nome)")
        .eq("tarefa_id", criada.id);

      saida.push({
        estado: "criada",
        id: criada.id,
        titulo: p.titulo,
        atribuidos: ((reais ?? []) as unknown as { membro: { nome: string } | null }[])
          .map((r) => r.membro?.nome).filter(Boolean) as string[],
      });
    }

    setResultados(saida);
    setPublicando(false);
  }

  const criadas = resultados?.filter((r) => r.estado === "criada") ?? [];
  const falhou = resultados?.find((r) => r.estado === "falhou");
  const naoTentadas = resultados?.filter((r) => r.estado === "nao-tentada") ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Publicar em lote</h1>
        <p className="text-sm text-tinta/70">
          cole ou suba o JSON do{" "}
          <a
            href="https://github.com/joaohelio-feob/apppi/blob/main/docs/CONTRATO-TAREFA.md"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-musgo"
          >
            contrato de tarefa
          </a>
        </p>
      </div>

      {/* ---------- resultado, quando já publicou ---------- */}
      {resultados && (
        <section aria-labelledby="res" className="mt-6 border border-linha bg-casca p-4">
          <h2 id="res" className="font-display text-lg font-semibold">
            {criadas.length} de {resultados.length} publicadas
            {origem && <span className="ml-2 font-mono text-xs font-normal text-tinta/70">de {origem}</span>}
          </h2>

          <div className="mt-3 space-y-4">
            <div>
              <h3 className="font-display text-xs font-semibold text-musgo">
                criadas · {criadas.length}
              </h3>
              {criadas.length === 0 ? (
                <p className="mt-1 text-sm text-tinta/70">nenhuma.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {criadas.map((r) => (
                    <li key={r.id} className="text-sm">
                      <Link href="/tarefas" className="underline underline-offset-4 hover:text-musgo">
                        {r.titulo}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-tinta/70">
                        #{r.id} · {r.atribuidos.length > 0 ? r.atribuidos.join(", ") : "sem responsável"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {falhou && (
              <div className="border-l-2 border-trigo pl-3">
                <h3 className="font-display text-xs font-semibold text-trigo">falhou · 1</h3>
                <p className="mt-1 text-sm">{falhou.titulo}</p>
                <p className="mt-0.5 text-sm text-tinta/70">{falhou.erro}</p>
              </div>
            )}

            {naoTentadas.length > 0 && (
              <div>
                <h3 className="font-display text-xs font-semibold text-tinta/70">
                  não tentadas · {naoTentadas.length}
                </h3>
                <p className="mt-1 text-sm text-tinta/70">
                  Pare aqui: reenvie só estas, sem as já criadas, para não duplicar.
                </p>
                <ul className="mt-1 space-y-0.5">
                  {naoTentadas.map((r, i) => (
                    <li key={i} className="text-sm">{r.titulo}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            onClick={() => { setResultados(null); setTexto(""); setNomeArquivo(null); }}
            className="mt-4 border border-linha px-3 py-1.5 text-xs transition-opacity duration-micro ease-entrada hover:bg-campo"
          >
            publicar outro lote
          </button>
        </section>
      )}

      {/* ---------- entrada ---------- */}
      {!resultados && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer border border-linha bg-casca px-3 py-1.5 text-xs transition-opacity duration-micro ease-entrada hover:bg-campo">
              escolher arquivo .json
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
              <span className="font-mono text-xs text-tinta/70">{nomeArquivo}</span>
            )}
            <button
              onClick={() => { setTexto(EXEMPLO); setNomeArquivo(null); }}
              className="text-xs text-tinta/70 underline underline-offset-4 transition-opacity duration-micro ease-entrada hover:text-tinta"
            >
              usar um exemplo
            </button>
          </div>

          <label className="mt-3 block">
            <span className="text-xs text-tinta/70">JSON da tarefa ou lista de tarefas</span>
            <textarea
              value={texto}
              onChange={(e) => { setTexto(e.target.value); setNomeArquivo(null); }}
              rows={10}
              spellCheck={false}
              placeholder={'[\n  { "titulo": "…", "escopo": "individual" }\n]'}
              className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-mono text-xs"
            />
          </label>

          {carregando && (
            <p className="mt-3 text-sm text-tinta/70">
              carregando frentes e integrantes… a conferência dos nomes começa quando elas chegarem.
            </p>
          )}

          {erroCarga && (
            <p className="mt-3 border-l-2 border-trigo pl-3 text-sm">
              Não deu pra carregar frentes e integrantes: {erroCarga}. Sem essas listas não há
              como validar os nomes do lote, então a publicação fica bloqueada. Recarregue a
              página; se persistir, confira a conexão.
            </p>
          )}

          {/* ---------- erros de contrato ---------- */}
          {analise?.erroDeFormato && (
            <p className="mt-3 border-l-2 border-trigo pl-3 text-sm">{analise.erroDeFormato}</p>
          )}

          {analise && !analise.erroDeFormato && analise.erros.length > 0 && (
            <section aria-labelledby="err" className="mt-4 border-l-2 border-trigo pl-3">
              <h2 id="err" className="font-display text-lg font-semibold">
                {analise.erros.length} {analise.erros.length === 1 ? "problema" : "problemas"} — nada foi criado
              </h2>
              <p className="mt-1 text-sm text-tinta/70">
                O lote inteiro é recusado de propósito: não existe exclusão de tarefa, então
                não há como desfazer uma criada por engano.
              </p>
              <ul className="mt-2 space-y-1">
                {analise.erros.map((e, i) => (
                  <li key={i} className="text-sm">{e}</li>
                ))}
              </ul>
            </section>
          )}

          {/* ---------- prévia: o resultado, não o input ---------- */}
          {analise && !analise.erroDeFormato && analise.erros.length === 0 && previa.length > 0 && (
            <section aria-labelledby="prev" className="mt-6">
              <h2 id="prev" className="font-display text-lg font-semibold">
                {previa.length === 1 ? "1 tarefa pronta" : `${previa.length} tarefas prontas`}
              </h2>

              {frentesVazias.length > 0 && (
                <p className="mt-2 border-l-2 border-trigo pl-3 text-sm">
                  {frentesVazias.map((p) => p.frente?.nome).join(", ")} não tem nenhum integrante.
                  O banco recusaria a tarefa de frente, então corrija antes de publicar.
                </p>
              )}

              <div className="mt-2 border-t border-linha">
                {previa.map((p, i) => (
                  <div key={i} className="border-b border-linha py-2">
                    <p className="text-sm">{p.titulo}</p>
                    <p className="mt-0.5 text-xs text-tinta/70">
                      {p.escopo === "frente" ? (
                        <>
                          frente {p.frente?.nome} ·{" "}
                          {p.atribuidos.length > 0 ? (
                            <>
                              o trigger vai atribuir {p.atribuidos.length}:{" "}
                              <span className="text-tinta">{p.atribuidos.map((m) => m.nome).join(", ")}</span>
                            </>
                          ) : (
                            <span className="text-trigo">frente sem integrantes</span>
                          )}
                        </>
                      ) : (
                        <>
                          {p.responsavel ? p.responsavel.nome : "sem dono"}
                          {p.frente && <> · frente {p.frente.nome}</>}
                        </>
                      )}
                      {p.revisor ? <> · revisor {p.revisor.nome}</> : <> · sem revisor, conclui na entrega</>}
                      {p.prazo && <> · <span className="font-mono">{p.prazo}</span></>}
                      {" · "}prioridade {p.prioridade}
                      {p.criterios && <> · <span className="font-mono">{p.criterios.feitos}/{p.criterios.total}</span> critérios</>}
                      {p.local && p.local.tipo === "texto" && <> · local de entrega vira anotação, não link</>}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={publicar}
                  disabled={!podePublicar}
                  className="bg-tinta px-4 py-2 text-sm font-semibold text-campo transition-opacity duration-micro ease-entrada hover:bg-musgo disabled:opacity-40"
                >
                  {publicando ? "publicando…" : `Publicar ${previa.length === 1 ? "1 tarefa" : `${previa.length} tarefas`}`}
                </button>
                {!meuId && (
                  <span className="text-sm text-tinta/70">
                    Sem sessão não dá pra publicar — as tarefas ficariam sem autor na Trilha.
                  </span>
                )}
              </div>
            </section>
          )}

          {!texto.trim() && !carregando && !erroCarga && (
            <p className="mt-6 text-sm text-tinta/70">
              Nada colado ainda. Suba um arquivo, cole o JSON, ou clique em “usar um exemplo”.
            </p>
          )}
        </>
      )}
    </div>
  );
}
