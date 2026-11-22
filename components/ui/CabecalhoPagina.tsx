import Link from "next/link";
import type { ReactNode } from "react";

export default function CabecalhoPagina({
  titulo,
  descricao,
  categoria,
  icone,
  voltar,
  contagem,
  acoes,
  destaque = false,
}: {
  titulo: string;
  descricao?: ReactNode;
  categoria?: string;
  icone?: ReactNode;
  voltar?: { href: string; rotulo: string };
  contagem?: string | number;
  acoes?: ReactNode;
  destaque?: boolean;
}) {
  return (
    <header
      className={
        destaque
          ? "rounded-xl border-b-4 border-b-broto bg-tinta p-6 text-campo shadow-destaque"
          : "mb-6 border-b border-linha pb-5"
      }
    >
      {voltar && (
        <Link
          href={voltar.href}
          className={`mb-3 inline-flex items-center gap-1.5 font-mono text-xs underline-offset-4 hover:underline ${
            destaque ? "text-campo/85" : "text-tinta/70 hover:text-tinta"
          }`}
        >
          ← {voltar.rotulo}
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {categoria && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold ${
                destaque
                  ? "bg-campo/15 text-campo"
                  : "border border-linha bg-casca text-tinta"
              }`}
            >
              {icone}
              {categoria}
            </span>
          )}

          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {titulo}
            </h1>
            {contagem !== undefined && (
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold ${
                  destaque
                    ? "bg-broto text-tinta"
                    : "border border-linha bg-papel text-tinta"
                }`}
              >
                {contagem}
              </span>
            )}
          </div>

          {descricao && (
            <p
              className={`mt-2 max-w-2xl text-sm leading-relaxed ${
                destaque ? "text-campo/85" : "text-tinta/70"
              }`}
            >
              {descricao}
            </p>
          )}
        </div>

        {acoes && (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {acoes}
          </div>
        )}
      </div>
    </header>
  );
}
