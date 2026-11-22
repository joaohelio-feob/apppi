"use client";

import Dialogo from "./ui/Dialogo";
import Botao from "./ui/Botao";
import { useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { IconeDica, IconeEntregas, IconeGit } from "./ui/Icones";

const MINIMO_O_QUE_MUDOU = 10;

/**
 * Modal de Entrega — o responsável preenche pra marcar a atividade como
 * entregue. Só faz o insert em `entregas`; quem decide se a tarefa vira
 * "revisao" ou "concluida" é o trigger aplicar_estado_pos_entrega() no banco.
 */
export default function ModalEntrega({
  tarefaId,
  aoFechar,
  aoEntregar,
}: {
  tarefaId: number;
  aoFechar: () => void;
  aoEntregar?: () => void;
}) {
  const [arquivoDrive, setArquivoDrive] = useState("");
  const [precisaCommit, setPrecisaCommit] = useState(false);
  const [commitNome, setCommitNome] = useState("");
  const [oQueMudou, setOQueMudou] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const tamanhoResumo = oQueMudou.trim().length;
  const valido =
    arquivoDrive.trim().length > 0 &&
    tamanhoResumo >= MINIMO_O_QUE_MUDOU &&
    (!precisaCommit || commitNome.trim().length > 0);

  async function entregar() {
    if (enviando) return;
    if (!valido) {
      setErro(
        arquivoDrive.trim().length === 0
          ? "Informe o nome do arquivo no Drive."
          : precisaCommit && commitNome.trim().length === 0
            ? "Informe o nome do commit."
            : `"O que mudou" precisa de pelo menos ${MINIMO_O_QUE_MUDOU} caracteres.`,
      );
      return;
    }

    setErro(null);
    setEnviando(true);
    const supabase = criarClienteNavegador();
    const { data: sessao } = await supabase.auth.getUser();

    const { error } = await supabase.from("entregas").insert({
      tarefa_id: tarefaId,
      autor_id: sessao.user?.id,
      arquivo_drive: arquivoDrive.trim(),
      precisa_commit: precisaCommit,
      commit_nome: precisaCommit ? commitNome.trim() : null,
      o_que_mudou: oQueMudou.trim(),
    });

    setEnviando(false);
    if (error) {
      setErro("Não deu pra registrar a entrega. Tenta de novo.");
      return;
    }

    aoEntregar?.();
    aoFechar();
  }

  return (
    <Dialogo titulo="Entregar atividade" aoFechar={aoFechar} ocupado={enviando}>
      <div className="flex items-start gap-3 border-b border-linha pb-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-broto/25 text-tinta">
          <IconeEntregas className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight">
            Entregar atividade
          </h2>
          <p className="mt-0.5 text-xs text-tinta/70">
            Cada entrega gera um registro imutável na trilha da equipe.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-linha bg-campo/70 p-3 text-xs text-tinta/70">
        <IconeDica className="mt-0.5 h-4 w-4 shrink-0 text-musgo" />
        <span>
          Se a tarefa tiver revisor, ela vai para{" "}
          <strong className="text-tinta">Em revisão</strong>; sem revisor, ela
          é marcada como <strong className="text-tinta">Concluída</strong> na
          hora.
        </span>
      </div>

      <div className="mt-4 space-y-3.5">
        <label className="block text-xs font-semibold text-tinta">
          Nome do arquivo no Drive
          <input
            className="campo mt-1.5"
            placeholder="Ex.: relatorio-sprint-3.pdf"
            value={arquivoDrive}
            onChange={(e) => setArquivoDrive(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-linha bg-campo/60 px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium text-tinta">
            <IconeGit className="h-4 w-4 text-musgo" />
            Essa atividade precisa de commit no Git?
          </span>
          <div className="flex gap-1 rounded-lg border border-linha bg-papel p-0.5">
            <button
              type="button"
              aria-pressed={!precisaCommit}
              onClick={() => setPrecisaCommit(false)}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                !precisaCommit
                  ? "bg-tinta text-campo"
                  : "text-tinta/70 hover:bg-casca"
              }`}
            >
              Não
            </button>
            <button
              type="button"
              aria-pressed={precisaCommit}
              onClick={() => setPrecisaCommit(true)}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                precisaCommit
                  ? "bg-tinta text-campo"
                  : "text-tinta/70 hover:bg-casca"
              }`}
            >
              Sim
            </button>
          </div>
        </div>

        {precisaCommit && (
          <label className="block text-xs font-semibold text-tinta">
            Nome do commit
            <input
              className="campo mt-1.5 font-mono"
              placeholder="Ex.: fix: corrige cálculo de dias até o prazo"
              value={commitNome}
              onChange={(e) => setCommitNome(e.target.value)}
            />
          </label>
        )}

        <label className="block text-xs font-semibold text-tinta">
          O que mudou nesta entrega
          <textarea
            className="campo mt-1.5"
            rows={3}
            placeholder="Descreva o que foi feito nessa entrega…"
            value={oQueMudou}
            onChange={(e) => setOQueMudou(e.target.value)}
          />
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-linha">
              <div
                className={`h-full w-full origin-left rounded-full transition-transform duration-micro ease-entrada ${
                  tamanhoResumo >= MINIMO_O_QUE_MUDOU ? "bg-musgo" : "bg-trigo"
                }`}
                style={{
                  transform: `scaleX(${Math.min(1, tamanhoResumo / MINIMO_O_QUE_MUDOU)})`,
                }}
              />
            </div>
            <span className="font-mono text-xs text-tinta/70">
              {tamanhoResumo}/{MINIMO_O_QUE_MUDOU} mín.
            </span>
          </div>
        </label>

        {erro && (
          <p
            role="alert"
            className="rounded-lg border border-trigo bg-trigo/15 px-3 py-2 font-mono text-xs text-tinta"
          >
            {erro}
          </p>
        )}
      </div>

      <div className="mt-5 flex gap-2 border-t border-linha pt-4">
        <Botao
          variante="destaque"
          onClick={entregar}
          disabled={!valido || enviando}
        >
          {enviando ? "Enviando…" : "Confirmar entrega"}
        </Botao>
        <Botao variante="secundario" disabled={enviando} onClick={aoFechar}>
          Cancelar
        </Botao>
      </div>
    </Dialogo>
  );
}
