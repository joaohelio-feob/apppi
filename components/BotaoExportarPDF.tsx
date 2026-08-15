"use client";

export default function BotaoExportarPDF() {
  return (
    <button
      onClick={() => window.print()}
      className="border border-tinta px-4 py-2 text-sm font-semibold hover:bg-tinta hover:text-campo"
    >
      Exportar PDF
    </button>
  );
}
