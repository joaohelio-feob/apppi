"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase-browser";

const paginas = [
  { href: "/",             rotulo: "Semana" },
  { href: "/tarefas",      rotulo: "Quadro" },
  { href: "/atribuicoes",  rotulo: "Atribuições" },
  { href: "/calendario",   rotulo: "Calendário" },
  { href: "/equipe",       rotulo: "Equipe" },
  { href: "/entregas",     rotulo: "Entregas" },
  { href: "/relatorio",    rotulo: "Trilha" },
];

export default function Navegacao() {
  const caminho = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  useEffect(() => { setAberto(false); }, [caminho]);

  if (caminho === "/login") return null;

  async function sair() {
    await criarClienteNavegador().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-linha bg-campo/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-x-6 px-4 py-4 sm:px-6">
        <Link href="/" className="font-display text-lg font-extrabold tracking-tight">
          Caderno de Campo
        </Link>

        <nav className="hidden gap-1 text-sm sm:flex">
          {paginas.map((p) => {
            const ativo = caminho === p.href;
            return (
              <Link
                key={p.href}
                href={p.href}
                className={`px-3 py-1.5 transition-colors ${
                  ativo
                    ? "bg-tinta text-campo"
                    : "text-tinta/70 hover:bg-casca hover:text-tinta"
                }`}
              >
                {p.rotulo}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={sair}
          className="ml-auto hidden font-mono text-xs text-tinta/60 underline underline-offset-4 hover:text-tinta sm:block"
        >
          sair
        </button>

        <button
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          aria-label="Abrir menu"
          className="ml-auto flex h-9 w-9 flex-col items-center justify-center gap-1 border border-linha sm:hidden"
        >
          <span className={`h-px w-5 bg-tinta transition-transform ${aberto ? "translate-y-[3px] rotate-45" : ""}`} />
          <span className={`h-px w-5 bg-tinta transition-opacity ${aberto ? "opacity-0" : ""}`} />
          <span className={`h-px w-5 bg-tinta transition-transform ${aberto ? "-translate-y-[3px] -rotate-45" : ""}`} />
        </button>
      </div>

      {aberto && (
        <nav className="flex flex-col border-t border-linha px-4 py-2 text-sm sm:hidden">
          {paginas.map((p) => {
            const ativo = caminho === p.href;
            return (
              <Link
                key={p.href}
                href={p.href}
                className={`px-2 py-2.5 ${ativo ? "font-semibold text-tinta" : "text-tinta/70"}`}
              >
                {p.rotulo}
              </Link>
            );
          })}
          <button
            onClick={sair}
            className="mt-1 border-t border-linha px-2 py-2.5 text-left font-mono text-xs text-tinta/60"
          >
            sair
          </button>
        </nav>
      )}
    </header>
  );
}
