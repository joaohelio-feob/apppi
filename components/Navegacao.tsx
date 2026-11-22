"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { useToast } from "./ToastProvider";
import { useNovaTarefa } from "./NovaTarefaProvider";
import GuiaPIModal from "./GuiaPIModal";
import {
  IconeAjuda,
  IconeAtribuicoes,
  IconeCaderno,
  IconeCalendario,
  IconeChevron,
  IconeCodigo,
  IconeEntregas,
  IconeEquipe,
  IconeFrentes,
  IconeMais,
  IconeQuadro,
  IconeReunioes,
  IconeRevisoes,
  IconeSair,
  IconeSemana,
  IconeSprint,
  IconeTrilha,
} from "./ui/Icones";

type DestinoPrimario = {
  href: string;
  rotulo: string;
  icone: ReactNode;
};

type DestinoSecundario = DestinoPrimario & {
  subtitulo: string;
};

/**
 * Hierarquia por frequência de uso:
 * PRIMÁRIOS são o ciclo diário de uma tarefa: ver o que é meu, mover, checar
 * prazo, entregar, revisar.
 */
const PRIMARIOS: DestinoPrimario[] = [
  { href: "/", rotulo: "Semana", icone: <IconeSemana className="h-4 w-4" /> },
  {
    href: "/tarefas",
    rotulo: "Quadro",
    icone: <IconeQuadro className="h-4 w-4" />,
  },
  {
    href: "/calendario",
    rotulo: "Calendário",
    icone: <IconeCalendario className="h-4 w-4" />,
  },
  {
    href: "/entregas",
    rotulo: "Entregas",
    icone: <IconeEntregas className="h-4 w-4" />,
  },
  {
    href: "/revisoes",
    rotulo: "Revisões",
    icone: <IconeRevisoes className="h-4 w-4" />,
  },
];

/** SECUNDÁRIOS são consulta, configuração e relatório: semanal, não diário. */
const SECUNDARIOS: DestinoSecundario[] = [
  {
    href: "/atribuicoes",
    rotulo: "Atribuições",
    subtitulo: "Tabela rápida para editar vários campos",
    icone: <IconeAtribuicoes className="h-4 w-4" />,
  },
  {
    href: "/equipe",
    rotulo: "Equipe",
    subtitulo: "Papéis, frentes e painéis individuais",
    icone: <IconeEquipe className="h-4 w-4" />,
  },
  {
    href: "/frentes",
    rotulo: "Frentes",
    subtitulo: "Sub-times e matérias do PI",
    icone: <IconeFrentes className="h-4 w-4" />,
  },
  {
    href: "/codigo",
    rotulo: "Código",
    subtitulo: "Espelho do GitHub (commits, PRs e CI)",
    icone: <IconeCodigo className="h-4 w-4" />,
  },
  {
    href: "/relatorio",
    rotulo: "Trilha",
    subtitulo: "Histórico oficial pro professor",
    icone: <IconeTrilha className="h-4 w-4" />,
  },
  {
    href: "/reunioes",
    rotulo: "Reuniões",
    subtitulo: "Atas, presentes e decisões",
    icone: <IconeReunioes className="h-4 w-4" />,
  },
  {
    href: "/sprint",
    rotulo: "Sprint Report",
    subtitulo: "Entregas e métricas por período",
    icone: <IconeSprint className="h-4 w-4" />,
  },
];

export default function Navegacao() {
  const { avisar } = useToast();
  const { abrir: abrirNovaTarefa } = useNovaTarefa();
  const [saindo, setSaindo] = useState(false);
  const [guiaAberto, setGuiaAberto] = useState(false);
  const caminho = usePathname();
  const router = useRouter();
  const [menuMovel, setMenuMovel] = useState(false);
  const [mais, setMais] = useState(false);
  const botaoMais = useRef<HTMLButtonElement>(null);
  const botaoMovel = useRef<HTMLButtonElement>(null);
  const areaMais = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuMovel(false);
    setMais(false);
  }, [caminho]);

  // "Mais" abre por clique, nunca por hover — hover não existe em toque. Fecha
  // com Esc e com clique fora, como qualquer disclosure.
  useEffect(() => {
    if (!mais && !menuMovel) return;
    function noDocumento(e: MouseEvent) {
      if (areaMais.current && !areaMais.current.contains(e.target as Node))
        setMais(false);
    }
    function naTecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (mais) {
          setMais(false);
          botaoMais.current?.focus();
        }
        if (menuMovel) {
          setMenuMovel(false);
          botaoMovel.current?.focus();
        }
      }
    }
    document.addEventListener("mousedown", noDocumento);
    document.addEventListener("keydown", naTecla);
    return () => {
      document.removeEventListener("mousedown", noDocumento);
      document.removeEventListener("keydown", naTecla);
    };
  }, [mais, menuMovel]);

  if (caminho === "/login") return null;

  async function sair() {
    if (saindo) return;
    setSaindo(true);
    const { error } = await criarClienteNavegador().auth.signOut();
    setSaindo(false);
    if (error) {
      avisar("Não foi possível sair. Tente novamente.");
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  /**
   * Quando a rota ativa está no grupo secundário, "Mais" assume o rótulo dela
   * e fica marcado.
   */
  const secundarioAtivo =
    SECUNDARIOS.find(
      (d) => d.href === caminho || caminho.startsWith(`${d.href}/`),
    ) ?? null;

  const ehRotaAtiva = (href: string) =>
    caminho === href || (href !== "/" && caminho.startsWith(`${href}/`));

  /** Sublinhado espesso, não cor: o estado ativo não pode depender só de cor. */
  const classeDestino = (ativo: boolean) =>
    `inline-flex items-center gap-1.5 whitespace-nowrap rounded-t-lg border-b-2 min-h-10 px-2.5 py-2 text-xs sm:text-sm transition-colors duration-micro ease-entrada ${
      ativo
        ? "border-musgo bg-casca/80 font-semibold text-tinta"
        : "border-transparent text-tinta/70 hover:border-linha hover:bg-casca/40 hover:text-tinta"
    }`;

  function teclasDoMenu(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const itens = Array.from(
      areaMais.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
        [],
    );
    if (itens.length === 0) return;
    const i = itens.indexOf(document.activeElement as HTMLElement);
    const proximo =
      e.key === "ArrowDown"
        ? itens[(i + 1) % itens.length]
        : itens[(i - 1 + itens.length) % itens.length];
    proximo.focus();
  }

  return (
    <>
      <header className="border-b border-linha bg-papel/95 shadow-cartao print:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-x-3 px-4 py-2.5 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 whitespace-nowrap rounded-lg py-1 pr-2 font-display text-base font-extrabold tracking-tight text-tinta transition-colors duration-micro ease-entrada hover:text-musgo"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-musgo text-campo shadow-cartao">
              <IconeCaderno className="h-4 w-4" />
            </span>
            <span>Caderno de Campo</span>
            <span className="rounded-full bg-broto/25 px-2 py-0.5 font-mono text-xs font-semibold text-tinta">
              PI
            </span>
          </Link>

          <nav
            aria-label="Seções do painel"
            className="hidden items-center gap-x-1 lg:flex"
          >
            {PRIMARIOS.map((d) => {
              const ativo = ehRotaAtiva(d.href);
              return (
                <Link
                  key={d.href}
                  href={d.href}
                  aria-current={ativo ? "page" : undefined}
                  className={classeDestino(ativo)}
                >
                  <span className={ativo ? "text-musgo" : "text-tinta/70"}>
                    {d.icone}
                  </span>
                  {d.rotulo}
                </Link>
              );
            })}

            <div ref={areaMais} className="relative" onKeyDown={teclasDoMenu}>
              <button
                ref={botaoMais}
                onClick={() => setMais((a) => !a)}
                aria-expanded={mais}
                aria-haspopup="menu"
                className={classeDestino(!!secundarioAtivo)}
              >
                {secundarioAtivo
                  ? `Mais · ${secundarioAtivo.rotulo}`
                  : "Mais"}
                <IconeChevron
                  className={`h-3.5 w-3.5 transition-transform duration-micro ease-entrada ${
                    mais ? "rotate-180" : ""
                  }`}
                />
              </button>

              {mais && (
                <div
                  role="menu"
                  aria-label="Mais seções"
                  className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-linha bg-papel p-2 shadow-destaque"
                >
                  {SECUNDARIOS.map((d) => {
                    const ativo = ehRotaAtiva(d.href);
                    return (
                      <Link
                        key={d.href}
                        href={d.href}
                        role="menuitem"
                        aria-current={ativo ? "page" : undefined}
                        className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-micro ease-entrada ${
                          ativo
                            ? "bg-casca font-semibold text-tinta"
                            : "text-tinta hover:bg-casca/60"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                            ativo
                              ? "border-musgo bg-papel text-musgo"
                              : "border-linha bg-campo text-tinta/70"
                          }`}
                        >
                          {d.icone}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold leading-tight text-tinta">
                            {d.rotulo}
                          </span>
                          <span className="mt-0.5 block text-xs font-normal text-tinta/70">
                            {d.subtitulo}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          <div className="ml-auto hidden items-center gap-x-2 lg:flex">
            <button
              type="button"
              onClick={abrirNovaTarefa}
              className="botao botao-destaque min-h-9 px-3 py-1.5 text-xs"
            >
              <IconeMais className="h-3.5 w-3.5" />
              Nova
            </button>
            <button
              type="button"
              onClick={() => setGuiaAberto(true)}
              className="botao botao-secundario min-h-9 px-3 py-1.5 text-xs"
            >
              <IconeAjuda className="h-3.5 w-3.5 text-musgo" />
              Guia
            </button>
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-linha" />
            <button
              onClick={sair}
              disabled={saindo}
              className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-linha bg-campo px-3 py-1.5 text-xs font-medium text-tinta/70 transition-colors duration-micro ease-entrada hover:bg-casca hover:text-tinta"
            >
              <IconeSair className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={abrirNovaTarefa}
              aria-label="Criar nova tarefa"
              className="botao botao-destaque min-h-9 px-2.5 py-1.5 text-xs"
            >
              <IconeMais className="h-3.5 w-3.5" />
              Nova
            </button>
            <button
              type="button"
              onClick={() => setGuiaAberto(true)}
              aria-label="Abrir guia do PI"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-linha bg-campo text-tinta hover:bg-casca"
            >
              <IconeAjuda className="h-4 w-4 text-musgo" />
            </button>
            <button
              ref={botaoMovel}
              onClick={() => setMenuMovel((a) => !a)}
              aria-expanded={menuMovel}
              aria-label={menuMovel ? "Fechar mais seções" : "Abrir mais seções"}
              className="flex h-10 w-10 flex-col items-center justify-center gap-1 rounded-lg border border-linha bg-campo"
            >
              <span
                className={`h-px w-5 bg-tinta transition-transform duration-micro ease-entrada ${menuMovel ? "translate-y-[3px] rotate-45" : ""}`}
              />
              <span
                className={`h-px w-5 bg-tinta transition-opacity duration-micro ease-entrada ${menuMovel ? "opacity-0" : ""}`}
              />
              <span
                className={`h-px w-5 bg-tinta transition-transform duration-micro ease-entrada ${menuMovel ? "-translate-y-[3px] -rotate-45" : ""}`}
              />
            </button>
          </div>
        </div>

        <nav
          aria-label="Navegação diária"
          className="flex gap-1 overflow-x-auto border-t border-linha px-4 pt-1 lg:hidden"
        >
          {PRIMARIOS.map((d) => {
            const ativo = ehRotaAtiva(d.href);
            return (
              <Link
                key={d.href}
                href={d.href}
                aria-current={ativo ? "page" : undefined}
                className={classeDestino(ativo)}
              >
                <span className={ativo ? "text-musgo" : "text-tinta/70"}>
                  {d.icone}
                </span>
                {d.rotulo}
              </Link>
            );
          })}
        </nav>

        {menuMovel && (
          <nav
            aria-label="Seções do painel"
            className="flex flex-col gap-1 border-t border-linha bg-campo/60 px-4 py-3 text-sm lg:hidden"
          >
            {SECUNDARIOS.map((d) => {
              const ativo = ehRotaAtiva(d.href);
              return (
                <Link
                  key={d.href}
                  href={d.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 ${
                    ativo
                      ? "bg-papel font-semibold text-tinta shadow-cartao"
                      : "text-tinta hover:bg-papel/70"
                  }`}
                >
                  <span className="mt-0.5 text-musgo">{d.icone}</span>
                  <span>
                    <span className="block font-semibold">{d.rotulo}</span>
                    <span className="block text-xs font-normal text-tinta/70">
                      {d.subtitulo}
                    </span>
                  </span>
                </Link>
              );
            })}
            <button
              onClick={sair}
              disabled={saindo}
              className="mt-2 flex items-center gap-2 border-t border-linha px-2.5 pt-3 text-left text-xs font-medium text-tinta/70"
            >
              <IconeSair className="h-3.5 w-3.5" />
              Sair da conta
            </button>
          </nav>
        )}
      </header>

      {guiaAberto && <GuiaPIModal aoFechar={() => setGuiaAberto(false)} />}
    </>
  );
}
