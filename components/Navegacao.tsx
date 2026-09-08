"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase-browser";

type Destino = { href: string; rotulo: string };

/**
 * Hierarquia por frequência de uso, não por ordem de criação.
 *
 * Antes eram 12 destinos irmãos numa lista só, que quebrava em duas linhas
 * (medido: 101px de altura a 1440px, com o logo quebrando junto). Somar mais
 * um destino a cada tela nova é como se chega a 12.
 *
 * PRIMÁRIOS são o ciclo diário de uma tarefa: ver o que é meu, mover, checar
 * prazo, entregar, revisar. Cinco cabem numa linha com folga.
 */
const PRIMARIOS: Destino[] = [
  { href: "/",            rotulo: "Semana" },
  { href: "/tarefas",     rotulo: "Quadro" },
  { href: "/calendario",  rotulo: "Calendário" },
  { href: "/entregas",    rotulo: "Entregas" },
  { href: "/revisoes",    rotulo: "Revisões" },
];

/** SECUNDÁRIOS são consulta, configuração e relatório: semanal, não diário. */
const SECUNDARIOS: Destino[] = [
  { href: "/atribuicoes", rotulo: "Atribuições" },
  { href: "/equipe",      rotulo: "Equipe" },
  { href: "/frentes",     rotulo: "Frentes" },
  { href: "/codigo",      rotulo: "Código" },
  { href: "/relatorio",   rotulo: "Trilha" },
  { href: "/reunioes",    rotulo: "Reuniões" },
  { href: "/sprint",      rotulo: "Sprint Report" },
];

const TODOS = [...PRIMARIOS, ...SECUNDARIOS];

export default function Navegacao() {
  const caminho = usePathname();
  const router = useRouter();
  const [menuMovel, setMenuMovel] = useState(false);
  const [mais, setMais] = useState(false);
  const areaMais = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuMovel(false);
    setMais(false);
  }, [caminho]);

  // "Mais" abre por clique, nunca por hover — hover não existe em toque. Fecha
  // com Esc e com clique fora, como qualquer disclosure.
  useEffect(() => {
    if (!mais) return;
    function noDocumento(e: MouseEvent) {
      if (areaMais.current && !areaMais.current.contains(e.target as Node)) setMais(false);
    }
    function naTecla(e: KeyboardEvent) {
      if (e.key === "Escape") setMais(false);
    }
    document.addEventListener("mousedown", noDocumento);
    document.addEventListener("keydown", naTecla);
    return () => {
      document.removeEventListener("mousedown", noDocumento);
      document.removeEventListener("keydown", naTecla);
    };
  }, [mais]);

  if (caminho === "/login") return null;

  async function sair() {
    await criarClienteNavegador().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  /**
   * Quando a rota ativa está no grupo secundário, "Mais" assume o rótulo dela
   * e fica marcado. Sem isto o usuário perde a indicação de onde está — é a
   * forma clássica desse padrão falhar.
   */
  const secundarioAtivo = SECUNDARIOS.find((d) => d.href === caminho) ?? null;

  /** Sublinhado espesso, não cor: o estado ativo não pode depender de cor. */
  const classeDestino = (ativo: boolean) =>
    `whitespace-nowrap border-b-2 px-1 py-1 text-sm transition-colors duration-micro ease-entrada ${
      ativo
        ? "border-tinta font-semibold text-tinta"
        : "border-transparent text-tinta/70 hover:border-linha hover:text-tinta"
    }`;

  function teclasDoMenu(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const itens = Array.from(
      areaMais.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    if (itens.length === 0) return;
    const i = itens.indexOf(document.activeElement as HTMLElement);
    const proximo =
      e.key === "ArrowDown" ? itens[(i + 1) % itens.length] : itens[(i - 1 + itens.length) % itens.length];
    proximo.focus();
  }

  return (
    <header className="border-b border-linha bg-campo/80 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-x-4 px-4 py-3 sm:px-6">
        {/* whitespace-nowrap: o logo quebrava em duas linhas e empurrava a nav. */}
        <Link
          href="/"
          className="whitespace-nowrap font-display text-lg font-extrabold tracking-tight"
        >
          Caderno de Campo
        </Link>

        <nav aria-label="Seções do painel" className="hidden items-center gap-x-3 md:flex">
          {PRIMARIOS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              aria-current={caminho === d.href ? "page" : undefined}
              className={classeDestino(caminho === d.href)}
            >
              {d.rotulo}
            </Link>
          ))}

          <div ref={areaMais} className="relative" onKeyDown={teclasDoMenu}>
            <button
              onClick={() => setMais((a) => !a)}
              aria-expanded={mais}
              aria-haspopup="menu"
              className={classeDestino(!!secundarioAtivo)}
            >
              {secundarioAtivo ? `Mais · ${secundarioAtivo.rotulo}` : "Mais"}
              <span aria-hidden="true" className="ml-1 font-mono text-xs">▾</span>
            </button>

            {mais && (
              <div
                role="menu"
                aria-label="Mais seções"
                className="absolute right-0 top-full z-50 mt-1 min-w-[12rem] border border-linha bg-campo py-1 shadow-sm"
              >
                {SECUNDARIOS.map((d) => (
                  <Link
                    key={d.href}
                    href={d.href}
                    role="menuitem"
                    aria-current={caminho === d.href ? "page" : undefined}
                    className={`block px-3 py-1.5 text-sm transition-colors duration-micro ease-entrada ${
                      caminho === d.href
                        ? "bg-casca font-semibold text-tinta"
                        : "text-tinta/70 hover:bg-casca hover:text-tinta"
                    }`}
                  >
                    {d.rotulo}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* "sair" é ação, não destino: separado por um divisor e com a mesma
            forma dos outros controles do app — não mais sublinhado solto. */}
        <div className="ml-auto hidden items-center gap-x-4 md:flex">
          <span aria-hidden="true" className="h-5 w-px bg-linha" />
          <button
            onClick={sair}
            className="whitespace-nowrap border border-linha px-3 py-1 text-xs text-tinta/70 transition-colors duration-micro ease-entrada hover:bg-casca hover:text-tinta"
          >
            sair
          </button>
        </div>

        <button
          onClick={() => setMenuMovel((a) => !a)}
          aria-expanded={menuMovel}
          aria-label="Abrir menu"
          className="ml-auto flex h-9 w-9 flex-col items-center justify-center gap-1 border border-linha md:hidden"
        >
          <span className={`h-px w-5 bg-tinta transition-transform duration-micro ease-entrada ${menuMovel ? "translate-y-[3px] rotate-45" : ""}`} />
          <span className={`h-px w-5 bg-tinta transition-opacity duration-micro ease-entrada ${menuMovel ? "opacity-0" : ""}`} />
          <span className={`h-px w-5 bg-tinta transition-transform duration-micro ease-entrada ${menuMovel ? "-translate-y-[3px] -rotate-45" : ""}`} />
        </button>
      </div>

      {/* No celular a hierarquia não ajuda — a lista já rola. Mostra tudo. */}
      {menuMovel && (
        <nav aria-label="Seções do painel" className="flex flex-col border-t border-linha px-4 py-2 text-sm md:hidden">
          {TODOS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              aria-current={caminho === d.href ? "page" : undefined}
              className={`px-2 py-2.5 ${caminho === d.href ? "font-semibold text-tinta" : "text-tinta/70"}`}
            >
              {d.rotulo}
            </Link>
          ))}
          <button
            onClick={sair}
            className="mt-1 border-t border-linha px-2 py-2.5 text-left text-xs text-tinta/70"
          >
            sair
          </button>
        </nav>
      )}
    </header>
  );
}
