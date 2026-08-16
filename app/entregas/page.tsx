"use client";

import { useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { responsaveisDe, type Anexo, type Tarefa } from "@/lib/types";

export default function Entregas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberta, setAberta] = useState<Tarefa | null>(null);

  const supabase = criarClienteNavegador();

  async function carregar() {
    const { data } = await supabase
      .from("tarefas")
      .select("*, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel))")
      .eq("arquivada", false)
      .order("concluido_em", { ascending: false, nullsFirst: false });
    setTarefas((data ?? []) as Tarefa[]);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function atualizarNaLista(id: number, campos: Partial<Tarefa>) {
    setTarefas((atual) => atual.map((t) => (t.id === id ? { ...t, ...campos } : t)));
    setAberta((atual) => (atual && atual.id === id ? { ...atual, ...campos } : atual));
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-musgo">Relatório final</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Entregas</h1>
      <p className="mt-2 max-w-prose text-sm text-tinta/70">
        Toda tarefa, quem fez, quando terminou e se já está no Git. Clique numa linha para ver
        observações, anexos e marcar a entrega.
      </p>

      {carregando ? (
        <p className="mt-10 font-mono text-sm text-tinta/70">carregando…</p>
      ) : (
        <div className="mt-6 overflow-x-auto border border-linha">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-linha bg-casca font-mono text-xs uppercase tracking-wide text-tinta/70">
                <th className="px-3 py-2 text-left">Tarefa</th>
                <th className="px-3 py-2 text-left">Quem fez</th>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Subiu no Git</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {tarefas.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setAberta(t)}
                  className="cursor-pointer hover:bg-casca"
                >
                  <td className="px-3 py-2 font-semibold">{t.titulo}</td>
                  <td className="px-3 py-2 text-tinta/70">
                    {responsaveisDe(t).map((m) => m.nome).join(", ") || "sem responsável"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-tinta/70">
                    {t.concluido_em
                      ? new Date(t.concluido_em).toLocaleDateString("pt-BR")
                      : t.prazo
                      ? `prazo ${new Date(t.prazo + "T12:00:00").toLocaleDateString("pt-BR")}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 font-mono text-xs uppercase tracking-wide ${
                        t.subiu_git ? "bg-musgo text-campo" : "bg-linha text-tinta"
                      }`}
                    >
                      {t.subiu_git ? "sim" : "não"}
                    </span>
                  </td>
                </tr>
              ))}
              {tarefas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-tinta/70">
                    Nenhuma tarefa ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {aberta && (
        <PainelEntrega
          tarefa={aberta}
          aoFechar={() => setAberta(null)}
          aoAtualizar={atualizarNaLista}
        />
      )}
    </div>
  );
}

function PainelEntrega({
  tarefa,
  aoFechar,
  aoAtualizar,
}: {
  tarefa: Tarefa;
  aoFechar: () => void;
  aoAtualizar: (id: number, campos: Partial<Tarefa>) => void;
}) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [carregandoAnexos, setCarregandoAnexos] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const supabase = criarClienteNavegador();

  async function carregarAnexos() {
    const { data } = await supabase
      .from("anexos")
      .select("*, membros:autor_id(id, nome, papel)")
      .eq("tarefa_id", tarefa.id)
      .order("criado_em", { ascending: false });
    setAnexos((data ?? []) as Anexo[]);
    setCarregandoAnexos(false);
  }

  useEffect(() => { carregarAnexos(); }, [tarefa.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const caminho = `${tarefa.id}/${Date.now()}-${arquivo.name}`;

    const { error: erroUpload } = await supabase.storage.from("entregas").upload(caminho, arquivo);
    if (erroUpload) {
      setErro(erroUpload.message);
      setEnviando(false);
      return;
    }

    const { error: erroLinha } = await supabase.from("anexos").insert({
      tarefa_id: tarefa.id,
      autor_id: sessao.user?.id ?? null,
      nome: arquivo.name,
      caminho,
    });
    if (erroLinha) setErro(erroLinha.message);

    setEnviando(false);
    carregarAnexos();
  }

  async function salvarObservacoes(valor: string) {
    aoAtualizar(tarefa.id, { observacoes: valor });
    await supabase.from("tarefas").update({ observacoes: valor || null }).eq("id", tarefa.id);
  }

  async function alternarGit(valor: boolean) {
    aoAtualizar(tarefa.id, { subiu_git: valor });
    await supabase.from("tarefas").update({ subiu_git: valor }).eq("id", tarefa.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto border border-linha bg-campo p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-musgo">
              {responsaveisDe(tarefa).map((m) => m.nome).join(", ") || "sem responsável"}
            </p>
            <h2 className="mt-0.5 font-display text-xl font-bold">{tarefa.titulo}</h2>
          </div>
          <button onClick={aoFechar} className="font-mono text-xs text-tinta/70 hover:text-tinta">
            fechar
          </button>
        </div>

        <label className="mt-5 flex items-center gap-2 border border-linha bg-casca px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={tarefa.subiu_git}
            onChange={(e) => alternarGit(e.target.checked)}
          />
          Já subiu no Git
        </label>

        <div className="mt-4">
          <label className="block font-mono text-xs uppercase text-tinta/70">Observações</label>
          <textarea
            defaultValue={tarefa.observacoes ?? ""}
            rows={3}
            placeholder="Notas de quem entregou…"
            onBlur={(e) => {
              if (e.target.value !== (tarefa.observacoes ?? "")) salvarObservacoes(e.target.value);
            }}
            className="mt-1 w-full border border-linha bg-casca px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-5">
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
            {carregandoAnexos ? (
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
                    className="shrink-0 font-mono text-xs text-tinta/70 hover:text-trigo"
                  >
                    remover
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
