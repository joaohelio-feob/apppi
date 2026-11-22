import type { ReactNode } from "react";
import { IconeChevron, IconeDica } from "./Icones";

export default function GuiaDidatico({
  titulo,
  resumo,
  children,
  abertoPorPadrao = false,
  className = "",
}: {
  titulo: string;
  resumo?: string;
  children: ReactNode;
  abertoPorPadrao?: boolean;
  className?: string;
}) {
  return (
    <details
      open={abertoPorPadrao}
      className={`group rounded-xl border border-linha border-l-4 border-l-broto bg-papel shadow-cartao print:hidden ${className}`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-tinta transition-colors duration-micro ease-entrada hover:bg-casca/45 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-broto/25 text-tinta">
            <IconeDica className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-bold">
              {titulo}
            </span>
            {resumo && (
              <span className="block text-xs font-normal text-tinta/70">
                {resumo}
              </span>
            )}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-linha bg-casca/60 px-2.5 py-0.5 font-mono text-xs text-tinta/70">
          <span className="group-open:hidden">entender</span>
          <span className="hidden group-open:inline">ocultar</span>
          <IconeChevron className="h-3.5 w-3.5 transition-transform duration-micro ease-entrada group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-linha/80 px-4 py-3.5 text-sm text-tinta">
        {children}
      </div>
    </details>
  );
}
