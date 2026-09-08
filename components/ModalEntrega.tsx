"use client";

import { useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";

const MINIMO_O_QUE_MUDOU = 10;

/**
 * Modal de Entrega — o responsável preenche pra marcar a atividade como
 * entregue. Só faz o insert em `entregas`; quem decide se a tarefa vira
 * "revisao" ou "concluida" é o trigger aplicar_estado_pos_entrega() no
 * banco (ver supabase/schema.sql, seção 2d) — não duplica essa regra aqui.
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

  const valido =
    arquivoDrive.trim().length > 0 &&
    oQueMudou.trim().length >= MINIMO_O_QUE_MUDOU &&
    (!precisaCommit || commitNome.trim().length > 0);

  async function entregar() {
    if (!valido) {
      setErro(
        arquivoDrive.trim().length === 0
          ? "Informe o nome do arquivo no Drive."
          : precisaCommit && commitNome.trim().length === 0
          ? "Informe o nome do commit."
          : `"O que mudou" precisa de pelo menos ${MINIMO_O_QUE_MUDOU} caracteres.`
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-tinta/40 p-4 sm:items-center">
      <div className="w-full max-w-md border border-linha bg-campo p-5">
        <h2 className="font-display text-xl font-bold">Entregar atividade</h2>
        <p className="mt-1 text-sm text-tinta/70">
          Registra a entrega na trilha. Se a tarefa tiver revisor, ela vai pra revisão; senão, conclui direto.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-xs text-tinta/70">
            Nome do arquivo no Drive
            <input
              className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm text-tinta"
              placeholder="Ex.: relatorio-sprint-3.pdf"
              value={arquivoDrive}
              onChange={(e) => setArquivoDrive(e.target.value)}
            />
          </label>

          <div className="flex items-center justify-between border border-linha bg-casca px-3 py-2">
            <span className="text-sm">Essa atividade precisa de commit no Git?</span>
            <div className="flex gap-1 border border-linha p-0.5">
              <button
                type="button"
                onClick={() => setPrecisaCommit(false)}
                className={`px-3 py-1 text-xs ${
                  !precisaCommit ? "bg-tinta text-campo" : "text-tinta/70 hover:bg-campo"
                }`}
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => setPrecisaCommit(true)}
                className={`px-3 py-1 text-xs ${
                  precisaCommit ? "bg-tinta text-campo" : "text-tinta/70 hover:bg-campo"
                }`}
              >
                Sim
              </button>
            </div>
          </div>

          {precisaCommit && (
            <label className="block text-xs text-tinta/70">
              Nome do commit
              <input
                className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm text-tinta"
                placeholder="Ex.: fix: corrige cálculo de dias até o prazo"
                value={commitNome}
                onChange={(e) => setCommitNome(e.target.value)}
              />
            </label>
          )}

          <label className="block text-xs text-tinta/70">
            O que mudou
            <textarea
              className="mt-1 w-full border border-linha bg-casca px-3 py-2 font-corpo text-sm text-tinta"
              rows={3}
              placeholder="Descreva o que foi feito nessa entrega…"
              value={oQueMudou}
              onChange={(e) => setOQueMudou(e.target.value)}
            />
            <span className="mt-0.5 block text-right text-xs text-tinta/70">
              {oQueMudou.trim().length}/{MINIMO_O_QUE_MUDOU}
            </span>
          </label>

          {erro && <p className="font-mono text-xs text-trigo">{erro}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={entregar}
            disabled={!valido || enviando}
            className="bg-tinta px-4 py-2 text-sm font-semibold text-campo hover:bg-musgo disabled:opacity-50"
          >
            {enviando ? "Enviando…" : "Entregar"}
          </button>
          <button onClick={aoFechar} className="px-4 py-2 text-sm text-tinta/70 hover:text-tinta">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
