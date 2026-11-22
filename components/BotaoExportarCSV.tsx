"use client";

import { IconeDownload } from "./ui/Icones";

function escapar(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export default function BotaoExportarCSV({
  linhas,
  colunas,
  nomeArquivo,
  rotulo = "Baixar CSV",
}: {
  linhas: Record<string, unknown>[];
  colunas: string[];
  nomeArquivo: string;
  rotulo?: string;
}) {
  function exportar() {
    const csv = [
      colunas.join(";"),
      ...linhas.map((l) => colunas.map((c) => escapar(l[c])).join(";")),
    ].join("\n");

    const bom = String.fromCharCode(0xfeff);
    const url = URL.createObjectURL(
      new Blob([bom + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={exportar}
      disabled={linhas.length === 0}
      className="botao botao-secundario"
    >
      <IconeDownload className="h-4 w-4 text-musgo" />
      {rotulo}
    </button>
  );
}
