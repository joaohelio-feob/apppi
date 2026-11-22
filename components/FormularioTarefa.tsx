"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import Botao from "./ui/Botao";
import Campo from "./ui/Campo";
import Dialogo from "./ui/Dialogo";
import { useToast } from "./ToastProvider";
import {
  PRIORIDADES,
  iniciaisDe,
  type Escopo,
  type Frente,
  type Membro,
  type Prioridade,
} from "@/lib/types";
import {
  IconeAlerta,
  IconeFechar,
  IconeFrentes,
  IconeUsuario,
} from "./ui/Icones";

export default function FormularioTarefa({
  membros,
  frentes,
  aoFechar,
  aoSalvar,
  autoFoco,
}: {
  membros: Membro[];
  frentes: Frente[];
  aoFechar: () => void;
  aoSalvar: () => void;
  autoFoco?: boolean;
}) {
  const { avisar } = useToast();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [escopo, setEscopo] = useState<Escopo>("individual");
  const [frenteId, setFrenteId] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [revisor, setRevisor] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [inicio, setInicio] = useState("");
  const [prazo, setPrazo] = useState("");
  const [localEntrega, setLocalEntrega] = useState("");
  const [issueNumero, setIssueNumero] = useState("");
  const [anexo, setAnexo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const campoTitulo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFoco) campoTitulo.current?.focus();
  }, [autoFoco]);

  const membrosDaFrente = useMemo(
    () => membros.filter((m) => String(m.frente_id ?? "") === frenteId),
    [membros, frenteId],
  );

  // Ninguém revisa a própria tarefa: exclui quem vai ser responsável — o
  // indivíduo escolhido, ou todo mundo da frente, se for tarefa de frente.
  const idsExcluidosDoRevisor = useMemo(
    () =>
      new Set(
        escopo === "frente"
          ? membrosDaFrente.map((m) => m.id)
          : responsavel
            ? [responsavel]
            : [],
      ),
    [escopo, membrosDaFrente, responsavel],
  );
  const membrosParaRevisor = useMemo(
    () => membros.filter((m) => !idsExcluidosDoRevisor.has(m.id)),
    [membros, idsExcluidosDoRevisor],
  );

  useEffect(() => {
    if (revisor && idsExcluidosDoRevisor.has(revisor)) setRevisor("");
  }, [revisor, idsExcluidosDoRevisor]);

  async function salvar() {
    if (salvando) return;
    setErro(null);
    if (!titulo.trim()) {
      setErro("Dê um título à tarefa para poder salvar.");
      return;
    }
    if (escopo === "frente" && !frenteId) {
      setErro("Escolha a frente dona da tarefa.");
      return;
    }
    if (escopo === "frente" && membrosDaFrente.length === 0) {
      setErro(
        "Essa frente ainda não tem ninguém — não dá pra criar tarefa de frente sem responsável.",
      );
      return;
    }

    setSalvando(true);
    const supabase = criarClienteNavegador();
    const { data: sessao } = await supabase.auth.getUser();

    const { data: tarefa, error } = await supabase
      .from("tarefas")
      .insert({
        titulo,
        descricao: descricao || null,
        criador_id: sessao.user?.id ?? null,
        escopo,
        frente_id: frenteId ? Number(frenteId) : null,
        revisor_id: revisor || null,
        prioridade,
        inicio: inicio || null,
        prazo: prazo || null,
        local_entrega: localEntrega || null,
        issue_numero: issueNumero ? Number(issueNumero) : null,
      })
      .select("id")
      .single();

    if (error || !tarefa) {
      setSalvando(false);
      setErro(error?.message ?? "Não deu pra criar a tarefa.");
      return;
    }

    // Tarefa de frente: o trigger no banco já atribui todo mundo da frente
    // sozinho. Individual: quem cria escolhe a pessoa (ou deixa sem dono).
    if (escopo === "individual" && responsavel) {
      const { error: erroResponsavel } = await supabase
        .from("tarefa_responsaveis")
        .insert({ tarefa_id: tarefa.id, membro_id: responsavel });
      if (erroResponsavel)
        avisar(
          "Tarefa criada, mas o responsável não foi salvo. Abra os detalhes para atribuir.",
        );
    }

    if (anexo) {
      const caminho = `${tarefa.id}/${Date.now()}-${anexo.name}`;
      const { error: erroUpload } = await supabase.storage
        .from("entregas")
        .upload(caminho, anexo);
      if (!erroUpload) {
        const { error: erroAnexo } = await supabase.from("anexos").insert({
          tarefa_id: tarefa.id,
          autor_id: sessao.user?.id ?? null,
          nome: anexo.name,
          caminho,
        });
        if (erroAnexo)
          avisar(
            "Tarefa criada, mas o anexo não foi associado. Confira nos detalhes.",
          );
      } else {
        avisar(
          "Tarefa criada, mas o anexo não foi enviado. Tente novamente nos detalhes.",
        );
      }
    }

    setSalvando(false);
    aoSalvar();
    aoFechar();
  }

  return (
    <Dialogo titulo="Nova tarefa" aoFechar={aoFechar} ocupado={salvando}>
      <form
        onInvalidCapture={(e) => {
          const opcoes = (e.target as HTMLElement).closest("details");
          if (opcoes) opcoes.open = true;
        }}
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-linha pb-3">
          <div>
            <h2 className="font-display text-xl font-extrabold tracking-tight">
              Nova tarefa
            </h2>
            <p className="text-xs text-tinta/70">
              Nasce no status A fazer e já entra registrada na Trilha.
            </p>
          </div>
          <Botao
            variante="discreto"
            onClick={aoFechar}
            disabled={salvando}
            aria-label="Fechar nova tarefa"
          >
            <IconeFechar className="h-4 w-4" />
            Fechar
          </Botao>
        </div>

        <fieldset disabled={salvando} className="space-y-4">
          <Campo titulo="Título">
            <input
              ref={campoTitulo}
              required
              className="campo"
              placeholder="O que precisa ser feito?"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </Campo>

          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-tinta">
              Escopo da tarefa
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={escopo === "individual"}
                onClick={() => setEscopo("individual")}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors duration-micro ease-entrada ${
                  escopo === "individual"
                    ? "border-musgo bg-casca shadow-cartao"
                    : "border-linha bg-campo/60 hover:bg-casca/50"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    escopo === "individual"
                      ? "bg-musgo text-campo"
                      : "bg-papel text-tinta/70"
                  }`}
                >
                  <IconeUsuario className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-display text-sm font-bold text-tinta">
                    Individual
                  </span>
                  <span className="mt-0.5 block text-xs text-tinta/70">
                    1 pessoa responsável; frente opcional como tema.
                  </span>
                </span>
              </button>

              <button
                type="button"
                aria-pressed={escopo === "frente"}
                onClick={() => setEscopo("frente")}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors duration-micro ease-entrada ${
                  escopo === "frente"
                    ? "border-musgo bg-casca shadow-cartao"
                    : "border-linha bg-campo/60 hover:bg-casca/50"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    escopo === "frente"
                      ? "bg-musgo text-campo"
                      : "bg-papel text-tinta/70"
                  }`}
                >
                  <IconeFrentes className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-display text-sm font-bold text-tinta">
                    Da frente
                  </span>
                  <span className="mt-0.5 block text-xs text-tinta/70">
                    Atribui todos os integrantes da frente automaticamente.
                  </span>
                </span>
              </button>
            </div>
          </fieldset>

          {escopo === "individual" ? (
            <Campo titulo="Responsável">
              <select
                className="campo"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
              >
                <option value="">Ainda sem responsável</option>
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </Campo>
          ) : (
            <Campo titulo="Frente dona da tarefa">
              <select
                required
                className="campo"
                value={frenteId}
                onChange={(e) => setFrenteId(e.target.value)}
              >
                <option value="">Escolha a frente</option>
                {frentes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
              {frenteId && (
                <div className="mt-2 rounded-lg border border-linha bg-campo/70 p-2.5">
                  {membrosDaFrente.length > 0 ? (
                    <>
                      <p className="text-xs font-medium text-tinta/70">
                        Será atribuída para {membrosDaFrente.length}{" "}
                        {membrosDaFrente.length === 1
                          ? "integrante"
                          : "integrantes"}
                        :
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {membrosDaFrente.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1 rounded-full border border-linha bg-papel px-2 py-0.5 text-xs font-medium text-tinta"
                          >
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-musgo font-mono text-xs text-campo">
                              {iniciaisDe(m.nome).slice(0, 1)}
                            </span>
                            {m.nome}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-tinta">
                      Essa frente ainda não tem integrantes.
                    </p>
                  )}
                </div>
              )}
            </Campo>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Campo titulo="Prazo">
              <input
                className="campo font-mono"
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </Campo>
            <Campo titulo="Prioridade">
              <select
                className="campo"
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as Prioridade)}
              >
                {PRIORIDADES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <details className="rounded-xl border border-linha bg-campo/50 px-3.5 py-2.5">
            <summary className="cursor-pointer py-1 font-display text-sm font-bold text-tinta">
              Mais opções (critérios, revisor, GitHub, anexo)
            </summary>
            <div className="mt-3 space-y-4">
              <Campo
                titulo="Descrição e critérios de aceite"
                ajuda="Use uma linha por critério: - [ ] O que precisa estar pronto."
              >
                <textarea
                  className="campo"
                  rows={4}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </Campo>
              {escopo === "individual" && (
                <Campo titulo="Frente / matéria (opcional)">
                  <select
                    className="campo"
                    value={frenteId}
                    onChange={(e) => setFrenteId(e.target.value)}
                  >
                    <option value="">Sem frente</option>
                    {frentes.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </Campo>
              )}
              <Campo titulo="Início">
                <input
                  className="campo font-mono"
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                />
              </Campo>
              <Campo
                titulo="Revisor"
                ajuda="Sem revisor, a entrega conclui a tarefa diretamente."
              >
                <select
                  className="campo"
                  value={revisor}
                  onChange={(e) => setRevisor(e.target.value)}
                >
                  <option value="">Sem revisor</option>
                  {membrosParaRevisor.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo titulo="Local de entrega">
                <input
                  className="campo"
                  value={localEntrega}
                  onChange={(e) => setLocalEntrega(e.target.value)}
                  placeholder="Link ou caminho do arquivo"
                />
              </Campo>
              <Campo titulo="Issue no GitHub">
                <input
                  className="campo font-mono"
                  type="number"
                  min={1}
                  value={issueNumero}
                  onChange={(e) => setIssueNumero(e.target.value)}
                />
              </Campo>
              <Campo titulo="Anexo">
                <input
                  className="campo"
                  type="file"
                  onChange={(e) => setAnexo(e.target.files?.[0] ?? null)}
                />
              </Campo>
            </div>
          </details>
        </fieldset>

        {erro && (
          <p
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-lg border border-trigo bg-trigo/15 px-3 py-2 text-sm font-medium text-tinta"
          >
            <IconeAlerta className="h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </p>
        )}

        <div className="sticky bottom-0 mt-5 flex gap-2 border-t border-linha bg-papel pt-3">
          <Botao type="submit" variante="destaque" disabled={salvando}>
            {salvando ? "Salvando…" : "Criar tarefa"}
          </Botao>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}
