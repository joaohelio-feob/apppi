"use client";

import { useEffect, useState } from "react";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import { IconeAlerta, IconeCodigo, IconeGit } from "@/components/ui/Icones";

type Commits = {
  configurado: boolean;
  total?: number;
  porAutor?: Record<string, number>;
  erro?: string;
};
type PR = {
  numero: number;
  titulo: string;
  estado: "aberto" | "fechado" | "mesclado";
  autor: string | null;
  criadoEm: string;
  fechadoEm: string | null;
  url: string;
  revisores: string[];
};
type PRs = {
  configurado: boolean;
  abertos?: number;
  fechados?: number;
  pullRequests?: PR[];
  erro?: string;
};
type CI = {
  configurado: boolean;
  estado?: string;
  url?: string | null;
  erro?: string;
};

const CORES_ESTADO: Record<string, string> = {
  aberto: "bg-ferro text-campo",
  fechado: "bg-casca text-tinta",
  mesclado: "bg-musgo text-campo",
};

export default function Codigo() {
  const [commits, setCommits] = useState<Commits | null>(null);
  const [prs, setPrs] = useState<PRs | null>(null);
  const [ci, setCi] = useState<CI | null>(null);

  useEffect(() => {
    fetch("/api/github/commits?dias=30")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setCommits)
      .catch(() =>
        setCommits({
          configurado: true,
          erro: "Não foi possível carregar os commits.",
        }),
      );
    fetch("/api/github/prs")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setPrs)
      .catch(() =>
        setPrs({
          configurado: true,
          erro: "Não foi possível carregar os pull requests.",
        }),
      );
    fetch("/api/github/ci")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setCi)
      .catch(() =>
        setCi({ configurado: true, erro: "Não foi possível carregar o CI." }),
      );
  }, []);

  const carregando = !commits || !prs || !ci;
  const naoConfigurado = commits && !commits.configurado;

  return (
    <div>
      <CabecalhoPagina
        categoria="Espelho do GitHub · Somente leitura"
        icone={<IconeCodigo className="h-3.5 w-3.5 text-musgo" />}
        titulo="O que está acontecendo no repositório"
        descricao="O painel nunca cria commit — cada integrante continua commitando pela própria máquina para preservar a autoria real no PI."
      />

      {carregando && (
        <p className="mt-10 text-sm text-tinta/70">Carregando dados do GitHub…</p>
      )}

      {naoConfigurado && (
        <div className="cartao border-l-4 border-l-trigo p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-trigo/20 text-tinta">
              <IconeAlerta className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-tinta">
                Integração com o GitHub ainda não configurada.
              </p>
              <p className="mt-1 text-sm leading-relaxed text-tinta/70">
                Defina{" "}
                <code className="rounded bg-casca px-1.5 py-0.5 font-mono text-xs text-tinta">
                  GITHUB_TOKEN
                </code>
                ,{" "}
                <code className="rounded bg-casca px-1.5 py-0.5 font-mono text-xs text-tinta">
                  GITHUB_ORG
                </code>{" "}
                e{" "}
                <code className="rounded bg-casca px-1.5 py-0.5 font-mono text-xs text-tinta">
                  GITHUB_REPO
                </code>{" "}
                nas variáveis de ambiente (veja o README) para ver commits, Pull
                Requests e status do CI aqui.
              </p>
            </div>
          </div>
        </div>
      )}

      {!carregando && !naoConfigurado && (
        <div className="space-y-6">
          <section className="cartao p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha pb-3">
              <h2 className="font-display text-lg font-bold text-tinta">
                CI na <span className="font-mono text-base">main</span>
              </h2>
              {ci?.erro ? (
                <p className="text-sm text-tinta">{ci.erro}</p>
              ) : (
                <StatusCI estado={ci?.estado} url={ci?.url ?? null} />
              )}
            </div>
            <p className="mt-2 text-xs text-tinta/70">
              Mostra o resultado da última verificação automática na branch
              principal.
            </p>
          </section>

          <section className="cartao p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-linha pb-3">
              <h2 className="font-display text-lg font-bold text-tinta">
                Commits por pessoa
              </h2>
              <span className="rounded-full border border-linha bg-casca px-2.5 py-0.5 font-mono text-xs text-tinta/70">
                últimos 30 dias
              </span>
            </div>
            {commits?.erro ? (
              <p className="text-sm text-tinta">{commits.erro}</p>
            ) : (
              <GraficoBarras dados={commits?.porAutor ?? {}} />
            )}
          </section>

          <section className="cartao p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-linha pb-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-tinta">
                <IconeGit className="h-4 w-4 text-musgo" />
                Pull Requests
              </h2>
              <span className="rounded-full border border-linha bg-casca px-2.5 py-0.5 font-mono text-xs text-tinta">
                {prs?.abertos ?? 0} abertos · {prs?.fechados ?? 0} fechados
              </span>
            </div>
            {prs?.erro ? (
              <p className="text-sm text-tinta">{prs.erro}</p>
            ) : (
              <div className="space-y-2.5">
                {(prs?.pullRequests ?? []).map((pr) => (
                  <div
                    key={pr.numero}
                    className="flex flex-wrap items-center gap-2.5 rounded-xl border border-linha bg-campo/60 px-3.5 py-2.5 text-sm"
                  >
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold uppercase ${CORES_ESTADO[pr.estado]}`}
                    >
                      {pr.estado}
                    </span>
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-tinta underline underline-offset-4 hover:text-musgo"
                    >
                      #{pr.numero} {pr.titulo}
                    </a>
                    <span className="rounded bg-casca px-2 py-0.5 font-mono text-xs text-tinta/70">
                      {pr.autor ?? "—"}
                    </span>
                    {pr.revisores.length > 0 && (
                      <span className="ml-auto font-mono text-xs text-tinta/70">
                        revisado por {pr.revisores.join(", ")}
                      </span>
                    )}
                  </div>
                ))}
                {(prs?.pullRequests?.length ?? 0) === 0 && (
                  <p className="text-sm text-tinta/70">
                    Nenhum Pull Request ainda.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function GraficoBarras({ dados }: { dados: Record<string, number> }) {
  const entradas = Object.entries(dados).sort((a, b) => b[1] - a[1]);
  const maior = Math.max(1, ...entradas.map(([, n]) => n));

  if (entradas.length === 0) {
    return (
      <p className="text-sm text-tinta/70">Nenhum commit no período.</p>
    );
  }

  return (
    <div className="space-y-2.5">
      {entradas.map(([autor, total]) => (
        <div key={autor} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-sm font-medium text-tinta">
            {autor}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-linha">
            <div
              className="h-full rounded-full bg-musgo"
              style={{ width: `${(total / maior) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right font-mono text-xs font-semibold text-tinta">
            {total}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatusCI({ estado, url }: { estado?: string; url?: string | null }) {
  const rotulo: Record<string, string> = {
    sucesso: "Passou",
    falha: "Falhou",
    pendente: "Rodando…",
    desconhecido: "Sem dados ainda",
  };
  const cor: Record<string, string> = {
    sucesso: "bg-musgo text-campo",
    falha: "bg-trigo text-tinta",
    pendente: "bg-ferro text-campo",
    desconhecido: "bg-casca text-tinta",
  };
  const chave = estado ?? "desconhecido";

  const conteudo = (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-xs font-semibold uppercase ${cor[chave]}`}
    >
      {rotulo[chave]}
    </span>
  );

  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="hover:opacity-90">
      {conteudo}
    </a>
  ) : (
    conteudo
  );
}
