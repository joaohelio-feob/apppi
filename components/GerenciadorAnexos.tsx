"use client";

import { useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import type { Anexo } from "@/lib/types";

/** Lista + upload + remoção de anexos de uma tarefa. Usado em /entregas e no DetalheTarefa. */
export default function GerenciadorAnexos({ tarefaId }: { tarefaId: number }) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const supabase = criarClienteNavegador();

  async function carregar() {
    const { data } = await supabase
      .from("anexos")
      .select("*, membros:autor_id(id, nome, papel)")
      .eq("tarefa_id", tarefaId)
      .order("criado_em", { ascending: false });
    setAnexos((data ?? []) as Anexo[]);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, [tarefaId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function abrirAnexo(caminho: string) {
    const { data } = await supabase.storage.from("entregas").createSignedUrl(caminho, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function apagarAnexo(anexo: Anexo) {
    if (!confirm(`Remover o anexo "${anexo.nome}"?`)) return;
    await supabase.storage.from("entregas").remove([anexo.caminho]);
    await supabase.from("anexos").delete().eq("id", anexo.id);
    setAnexos((atual) => atual.filter((a) => a.id !== anexo.id));
  }

  async function anexar(arquivo: File) {
    setErro(null);
    setEnviando(true);
    const { data: sessao } = await supabase.auth.getUser();
    const caminho = `${tarefaId}/${Date.now()}-${arquivo.name}`;

    const { error: erroUpload } = await supabase.storage.from("entregas").upload(caminho, arquivo);
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
      <div className="flex items-center justify-between">
        <label className="font-mono text-xs uppercase text-tinta/70">Anexos</label>
        <label className="cursor-pointer font-mono text-xs text-musgo underline underline-offset-4">
          {enviando ? "enviando…" : "+ anexar arquivo"}
          <input
            type="file"
            className="hidden"
            disabled={enviando}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) anexar(arquivo);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {erro && <p className="mt-1 font-mono text-xs text-trigo">{erro}</p>}

      <div className="mt-2 space-y-1.5">
        {carregando ? (
          <p className="font-mono text-xs text-tinta/70">carregando…</p>
        ) : anexos.length === 0 ? (
          <p className="text-xs text-tinta/70">Nenhum documento anexado ainda.</p>
        ) : (
          anexos.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 border border-linha bg-casca px-3 py-1.5">
              <button
                onClick={() => abrirAnexo(a.caminho)}
                className="truncate text-left text-sm underline underline-offset-4"
              >
                {a.nome}
              </button>
              <span className="shrink-0 font-mono text-xs text-tinta/70">
                {a.membros?.nome ?? "—"}
              </span>
              <button
                onClick={() => apagarAnexo(a)}
                className="shrink-0 font-mono text-xs text-tinta/70 hover:bg-trigo hover:text-tinta"
              >
                remover
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
