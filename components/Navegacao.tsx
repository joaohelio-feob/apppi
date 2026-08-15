"use client";

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

  if (caminho === "/login") return null;

  async function sair() {
    await criarClienteNavegador().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-linha bg-campo/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
        <Link href="/" className="font-display text-lg font-extrabold tracking-tight">
          Caderno de Campo
        </Link>

        <nav className="flex gap-1 text-sm">
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
          className="ml-auto font-mono text-xs text-tinta/60 underline underline-offset-4 hover:text-tinta"
        >
          sair
        </button>
      </div>
    </header>
  );
}
