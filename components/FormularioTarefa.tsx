"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { PRIORIDADES, type Escopo, type Frente, type Membro, type Prioridade } from "@/lib/types";

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
    [membros, frenteId]
  );

  // Ninguém revisa a própria tarefa: exclui quem vai ser responsável — o
  // indivíduo escolhido, ou todo mundo da frente, se for tarefa de frente.
  const idsExcluidosDoRevisor = useMemo(
    () => new Set(escopo === "frente" ? membrosDaFrente.map((m) => m.id) : responsavel ? [responsavel] : []),
    [escopo, membrosDaFrente, responsavel]
  );
  const membrosParaRevisor = useMemo(
    () => membros.filter((m) => !idsExcluidosDoRevisor.has(m.id)),
    [membros, idsExcluidosDoRevisor]
  );

  useEffect(() => {
    if (revisor && idsExcluidosDoRevisor.has(revisor)) setRevisor("");
  }, [revisor, idsExcluidosDoRevisor]);

  async function salvar() {
    if (!titulo.trim()) {
      setErro("Dê um título à tarefa para poder salvar.");
      return;
    }
    if (escopo === "frente" && !frenteId) {
      setErro("Escolha a frente dona da tarefa.");
      return;
    }
    if (escopo === "frente" && membrosDaFrente.length === 0) {
      setErro("Essa frente ainda não tem ninguém — não dá pra criar tarefa de frente sem responsável.");
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
      await supabase.from("tarefa_responsaveis").insert({ tarefa_id: tarefa.id, membro_id: responsavel });
    }

    if (anexo) {
      const caminho = `${tarefa.id}/${Date.now()}-${anexo.name}`;
      const { error: erroUpload } = await supabase.storage.from("entregas").upload(caminho, anexo);
      if (!erroUpload) {
        await supabase.from("anexos").insert({
          tarefa_id: tarefa.id,
          autor_id: sessao.user?.id ?? null,
          nome: anexo.name,
          caminho,
        });
      }
    }

    setSalvando(false);
    aoSalvar();
    aoFechar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-4 sm:items-center">
      <div className="w-full max-w-md border border-linha bg-campo p-5">
        <h2 className="font-display text-xl font-bold">Nova tarefa</h2>

        <div className="mt-4 space-y-3">
          <input
            ref={campoTitulo}
            className="w-full border border-linha bg-casca px-3 py-2 text-sm"
            placeholder="O que precisa ser feito"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvar()}
          />
          <textarea
            className="w-full border border-linha bg-casca px-3 py-2 text-sm"
            rows={3}
            placeholder="Detalhes, critérios de aceite…"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />

          <div className="flex gap-1 border border-linha p-1">
            <button
              type="button"
              onClick={() => setEscopo("individual")}
              className={`flex-1 py-1.5 font-mono text-xs uppercase ${
                escopo === "individual" ? "bg-tinta text-campo" : "text-tinta/70 hover:bg-casca"
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setEscopo("frente")}
              className={`flex-1 py-1.5 font-mono text-xs uppercase ${
                escopo === "frente" ? "bg-tinta text-campo" : "text-tinta/70 hover:bg-casca"
              }`}
            >
              Da frente
            </button>
          </div>

          {escopo === "individual" ? (
            <>
              <label className="block font-mono text-xs uppercase text-tinta/70">
                Responsável
                <select
                  className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm normal-case text-tinta"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                >
                  <option value="">Ainda sem dono</option>
                  {membros.map((m) => (
                    <option key={m.id} value={m.id}>{m.nome} · {m.papel}</option>
                  ))}
                </select>
              </label>
              <label className="block font-mono text-xs uppercase text-tinta/70">
                Frente (opcional)
                <select
                  className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm normal-case text-tinta"
                  value={frenteId}
                  onChange={(e) => setFrenteId(e.target.value)}
                >
                  <option value="">Sem frente</option>
                  {frentes.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <label className="block font-mono text-xs uppercase text-tinta/70">
              Frente
              <select
                className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm normal-case text-tinta"
                value={frenteId}
                onChange={(e) => setFrenteId(e.target.value)}
              >
                <option value="">Escolha a frente</option>
                {frentes.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
              {frenteId && (
                <span className="mt-1 block font-corpo text-xs normal-case text-tinta/70">
                  {membrosDaFrente.length > 0
                    ? `Será atribuída a: ${membrosDaFrente.map((m) => m.nome).join(", ")}`
                    : "Essa frente ainda não tem ninguém."}
                </span>
              )}
            </label>
          )}

          <label className="block font-mono text-xs uppercase text-tinta/70">
            Revisor (opcional)
            <select
              className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm normal-case text-tinta"
              value={revisor}
              onChange={(e) => setRevisor(e.target.value)}
            >
              <option value="">Sem revisor</option>
              {membrosParaRevisor.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
            <span className="mt-1 block font-corpo text-xs normal-case text-tinta/70">
              Sem revisor, a tarefa conclui direto quando for entregue.
            </span>
          </label>

          <label className="block font-mono text-xs uppercase text-tinta/70">
            Prioridade
            <select
              className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm normal-case text-tinta"
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value as Prioridade)}
            >
              {PRIORIDADES.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block font-mono text-xs uppercase text-tinta/70">
              Início
              <input
                type="date"
                className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm text-tinta"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </label>
            <label className="block font-mono text-xs uppercase text-tinta/70">
              Prazo
              <input
                type="date"
                className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm text-tinta"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </label>
          </div>
          <input
            className="w-full border border-linha bg-casca px-3 py-2 text-sm"
            placeholder="Local de entrega: link do Drive, Forms, GitHub… (opcional)"
            value={localEntrega}
            onChange={(e) => setLocalEntrega(e.target.value)}
          />
          <label className="block font-mono text-xs uppercase text-tinta/70">
            Nº da issue no GitHub (opcional)
            <input
              type="number"
              min={1}
              className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm normal-case text-tinta"
              placeholder="Ex.: 42"
              value={issueNumero}
              onChange={(e) => setIssueNumero(e.target.value)}
            />
          </label>
          <label className="block font-mono text-xs uppercase text-tinta/70">
            Anexar documento (opcional)
            <input
              type="file"
              onChange={(e) => setAnexo(e.target.files?.[0] ?? null)}
              className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-xs normal-case text-tinta file:mr-2 file:border-0 file:bg-tinta file:px-2 file:py-1 file:text-xs file:text-campo"
            />
          </label>

          {erro && <p className="font-mono text-xs text-trigo">{erro}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={salvar}
            disabled={salvando}
            className="bg-tinta px-4 py-2 text-sm font-semibold text-campo hover:bg-musgo disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Criar tarefa"}
          </button>
          <button onClick={aoFechar} className="px-4 py-2 text-sm text-tinta/70 hover:text-tinta">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
