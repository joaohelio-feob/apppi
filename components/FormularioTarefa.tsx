"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import Botao from "./ui/Botao";
import Campo from "./ui/Campo";
import Dialogo from "./ui/Dialogo";
import { useToast } from "./ToastProvider";
import {
  PRIORIDADES,
  type Escopo,
  type Frente,
  type Membro,
  type Prioridade,
} from "@/lib/types";

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
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Nova tarefa</h2>
          <Botao
            variante="discreto"
            onClick={aoFechar}
            disabled={salvando}
            aria-label="Fechar nova tarefa"
          >
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
            <legend className="mb-1 text-sm font-medium">Escopo</legend>
            <div className="flex gap-1 border border-linha p-1">
              {(["individual", "frente"] as Escopo[]).map((opcao) => (
                <Botao
                  key={opcao}
                  className="flex-1"
                  variante={escopo === opcao ? "primario" : "discreto"}
                  aria-pressed={escopo === opcao}
                  onClick={() => setEscopo(opcao)}
                >
                  {opcao === "individual" ? "Individual" : "Da frente"}
                </Botao>
              ))}
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
            <Campo
              titulo="Frente"
              ajuda={
                frenteId
                  ? membrosDaFrente.length
                    ? `Responsáveis: ${membrosDaFrente.map((m) => m.nome).join(", ")}`
                    : "Essa frente ainda não tem integrantes."
                  : undefined
              }
            >
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
          <details className="border-t border-linha pt-3">
            <summary className="cursor-pointer py-1 text-sm font-medium">
              Mais opções
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
                <Campo titulo="Frente (opcional)">
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
                  className="campo"
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
                  className="campo"
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
            className="mt-3 border-l-2 border-trigo pl-3 text-sm text-tinta"
          >
            {erro}
          </p>
        )}
        <div className="sticky bottom-0 mt-4 flex gap-2 border-t border-linha bg-campo pt-3">
          <Botao type="submit" disabled={salvando}>
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
