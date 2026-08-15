"use client";

import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataLocalISO } from "@/lib/datas";
import { useState } from "react";

export default function BotaoExportar() {
  const [gerando, setGerando] = useState(false);

  async function exportar() {
    setGerando(true);
    const supabase = criarClienteNavegador();
    const { data } = await supabase
      .from("relatorio_atividades")
      .select("*")
      .order("em", { ascending: true });

    const linhas = data ?? [];
    const colunas = ["em", "autor", "papel", "acao", "campo", "valor_antigo", "valor_novo", "tarefa", "status_atual"];
    const escapar = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const csv = [
      colunas.join(";"),
      ...linhas.map((l: Record<string, unknown>) => colunas.map((c) => escapar(l[c])).join(";")),
    ].join("\n");

    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `trilha-pi-${dataLocalISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setGerando(false);
  }

  return (
    <button
      onClick={exportar}
      disabled={gerando}
      className="border border-tinta px-4 py-2 text-sm font-semibold hover:bg-tinta hover:text-campo disabled:opacity-50"
    >
      {gerando ? "Gerando…" : "Baixar CSV para o professor"}
    </button>
  );
}
