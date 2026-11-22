"use client";

import { useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import type { Anexo } from "@/lib/types";
import ConfirmarAcao from "./ConfirmarAcao";
import { IconeAnexo } from "./ui/Icones";

/** Lista + upload + remoção de anexos de uma tarefa. */
export default function GerenciadorAnexos({ tarefaId }: { tarefaId: number }) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [apagando, setApagando] = useState<Anexo | null>(null);
  const [executandoApagar, setExecutandoApagar] = useState(false);

  const supabase = criarClienteNavegador();

  async function carregar() {
    const { data, error } = await supabase
      .from("anexos")
      .select("*, membros:autor_id(id, nome, papel)")
      .eq("tarefa_id", tarefaId)
      .order("criado_em", { ascending: false });
    if (error) setErro("Não foi possível carregar os anexos.");
    else setAnexos((data ?? []) as Anexo[]);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, [tarefaId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function abrirAnexo(caminho: string) {
    const { data } = await supabase.storage
      .from("entregas")
      .createSignedUrl(caminho, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function apagarAnexo(anexo: Anexo) {
    setExecutandoApagar(true);
    const { error: erroArquivo } = await supabase.storage
      .from("entregas")
      .remove([anexo.caminho]);
    const { error: erroRegistro } = erroArquivo
      ? { error: null }
      : await supabase.from("anexos").delete().eq("id", anexo.id);
    if (erroArquivo || erroRegistro) {
      setErro("Não foi possível concluir a remoção do anexo. Tente novamente.");
      setExecutandoApagar(false);
      setApagando(null);
      return;
    }
    setAnexos((atual) => atual.filter((a) => a.id !== anexo.id));
    setExecutandoApagar(false);
    setApagando(null);
  }

  async function anexar(arquivo: File) {
    setErro(null);
    setEnviando(true);
    const { data: sessao } = await supabase.auth.getUser();
    const caminho = `${tarefaId}/${Date.now()}-${arquivo.name}`;

    const { error: erroUpload } = await supabase.storage
      .from("entregas")
      .upload(caminho, arquivo);
    if (erroUpload) {
      setErro(erroUpload.message);
      setEnviando(false);
      return;
    }

    const { error: erroLinha } = await supabase.from("anexos").insert({
      tarefa_id: tarefaId,
      autor_id: sessao.user?.id ?? null,
      nome: arquivo.name,
      caminho,
    });
    if (erroLinha) setErro(erroLinha.message);

    setEnviando(false);
    carregar();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-tinta/70">Anexos</span>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-linha bg-papel px-2.5 py-1 font-mono text-xs font-semibold text-musgo transition-colors duration-micro ease-entrada hover:border-musgo hover:bg-casca focus-within:outline focus-within:outline-2 focus-within:outline-musgo">
          <IconeAnexo className="h-3.5 w-3.5" />
          {enviando ? "Enviando…" : "+ Anexar arquivo"}
          <input
            type="file"
            className="sr-only"
            disabled={enviando}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) anexar(arquivo);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {erro && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-trigo bg-trigo/15 px-3 py-2 font-mono text-xs text-tinta"
        >
          {erro}
        </p>
      )}

      <div className="mt-2 space-y-2">
        {carregando ? (
          <p className="text-xs text-tinta/70">Carregando…</p>
        ) : erro && anexos.length === 0 ? null : anexos.length === 0 ? (
          <p className="text-xs text-tinta/70">
            Nenhum documento anexado ainda.
          </p>
        ) : (
          anexos.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-linha bg-papel px-3 py-2 shadow-cartao"
            >
              <button
                type="button"
                onClick={() => abrirAnexo(a.caminho)}
                className="flex min-w-0 items-center gap-2 break-all text-left text-sm font-medium text-tinta underline underline-offset-4 hover:text-musgo"
              >
                <IconeAnexo className="h-3.5 w-3.5 shrink-0 text-musgo" />
                <span>{a.nome}</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="shrink-0 font-mono text-xs text-tinta/70">
                  {a.membros?.nome ?? "—"}
                </span>
                <button
                  type="button"
                  onClick={() => setApagando(a)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-tinta/70 transition-colors duration-micro ease-entrada hover:bg-trigo hover:text-tinta"
                >
                  Remover
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {apagando && (
        <ConfirmarAcao
          titulo="Remover este anexo?"
          descricao={
            <>
              <strong className="font-semibold text-tinta">
                {apagando.nome}
              </strong>{" "}
              é apagado do armazenamento e da lista.{" "}
              <strong className="font-semibold text-tinta">
                Não dá para desfazer
              </strong>{" "}
              — diferente de arquivar uma tarefa, aqui o arquivo deixa de
              existir. Se ele for a evidência de uma entrega, envie o substituto
              antes de remover.
            </>
          }
          rotuloConfirmar="Remover"
          executando={executandoApagar}
          aoConfirmar={() => apagarAnexo(apagando)}
          aoCancelar={() => setApagando(null)}
        />
      )}
    </div>
  );
}
