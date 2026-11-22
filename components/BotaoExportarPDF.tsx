"use client";

import { IconeImpressora } from "./ui/Icones";

export default function BotaoExportarPDF() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="botao botao-secundario"
    >
      <IconeImpressora className="h-4 w-4 text-musgo" />
      Exportar PDF
    </button>
  );
}
