"use client";

import { useEffect, useState } from "react";

type Commits = { configurado: boolean; total?: number; porAutor?: Record<string, number>; erro?: string };
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
type PRs = { configurado: boolean; abertos?: number; fechados?: number; pullRequests?: PR[]; erro?: string };
type CI = { configurado: boolean; estado?: string; url?: string | null; erro?: string };

const CORES_ESTADO: Record<string, string> = {
  aberto: "bg-ferro text-campo",
  fechado: "bg-linha text-tinta",
  mesclado: "bg-musgo text-campo",
};

export default function Codigo() {
  const [commits, setCommits] = useState<Commits | null>(null);
  const [prs, setPrs] = useState<PRs | null>(null);
  const [ci, setCi] = useState<CI | null>(null);

  useEffect(() => {
    fetch("/api/github/commits?dias=30").then((r) => r.json()).then(setCommits);
    fetch("/api/github/prs").then((r) => r.json()).then(setPrs);
    fetch("/api/github/ci").then((r) => r.json()).then(setCi);
  }, []);

  const carregando = !commits || !prs || !ci;
  const naoConfigurado = commits && !commits.configurado;

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        O que está acontecendo no repositório
      </h1>
      <p className="mt-2 max-w-prose text-sm text-tinta/70">
        Só leitura — o painel nunca cria commit. Cada um continua commitando pela própria
        máquina; isso aqui é só o espelho do que já está no GitHub.
      </p>

      {carregando && <p className="mt-10 text-sm text-tinta/70">carregando…</p>}

      {naoConfigurado && (
        <div className="mt-8 border border-trigo bg-casca p-4">
          <p className="font-semibold text-tinta">Integração com o GitHub ainda não configurada.</p>
          <p className="mt-1 text-sm text-tinta/70">
            Defina <code className="font-mono text-xs">GITHUB_TOKEN</code>,{" "}
            <code className="font-mono text-xs">GITHUB_ORG</code> e{" "}
            <code className="font-mono text-xs">GITHUB_REPO</code> nas variáveis de ambiente
            (veja o README) para ver commits, Pull Requests e status do CI aqui.
          </p>
        </div>
      )}

      {!carregando && !naoConfigurado && (
        <div className="mt-8 space-y-10">
          <section>
            <h2 className="mb-3 border-b border-linha pb-1 font-display text-lg font-semibold">
              Commits por pessoa <span className="text-xs font-normal text-tinta/70">últimos 30 dias</span>
            </h2>
            {commits?.erro ? (
              <p className="text-sm text-trigo">{commits.erro}</p>
            ) : (
              <GraficoBarras dados={commits?.porAutor ?? {}} />
            )}
          </section>

          <section>
            <h2 className="mb-3 border-b border-linha pb-1 font-display text-lg font-semibold">
              Pull Requests
              <span className="ml-2 font-mono text-xs font-normal text-tinta/70">
                {prs?.abertos ?? 0} abertos · {prs?.fechados ?? 0} fechados
              </span>
            </h2>
            {prs?.erro ? (
              <p className="text-sm text-trigo">{prs.erro}</p>
            ) : (
              <div className="space-y-2">
                {(prs?.pullRequests ?? []).map((pr) => (
                  <div key={pr.numero} className="flex flex-wrap items-center gap-2 border border-linha bg-casca px-3 py-2 text-sm">
                    <span className={`px-1.5 py-0.5 font-mono text-xs uppercase ${CORES_ESTADO[pr.estado]}`}>
                      {pr.estado}
                    </span>
                    <a href={pr.url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                      #{pr.numero} {pr.titulo}
                    </a>
                    <span className="font-mono text-xs text-tinta/70">{pr.autor ?? "—"}</span>
                    {pr.revisores.length > 0 && (
                      <span className="ml-auto font-mono text-xs text-tinta/70">
                        revisado por {pr.revisores.join(", ")}
                      </span>
                    )}
                  </div>
                ))}
                {(prs?.pullRequests?.length ?? 0) === 0 && (
                  <p className="text-sm text-tinta/70">Nenhum Pull Request ainda.</p>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 border-b border-linha pb-1 font-display text-lg font-semibold">
              CI na <span className="font-mono text-sm">main</span>
            </h2>
            {ci?.erro ? (
              <p className="text-sm text-trigo">{ci.erro}</p>
            ) : (
              <StatusCI estado={ci?.estado} url={ci?.url ?? null} />
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
    return <p className="text-sm text-tinta/70">Nenhum commit no período.</p>;
  }

  return (
    <div className="space-y-2">
      {entradas.map(([autor, total]) => (
        <div key={autor} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-sm">{autor}</span>
          <div className="h-3 flex-1 bg-linha">
            <div className="h-full bg-musgo" style={{ width: `${(total / maior) * 100}%` }} />
          </div>
          <span className="w-8 text-right font-mono text-xs text-tinta/70">{total}</span>
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
    desconhecido: "bg-linha text-tinta",
  };
  const chave = estado ?? "desconhecido";

  const conteudo = (
    <span className={`inline-block px-2 py-1 font-mono text-xs uppercase ${cor[chave]}`}>
      {rotulo[chave]}
    </span>
  );

  return url ? (
    <a href={url} target="_blank" rel="noreferrer">{conteudo}</a>
  ) : conteudo;
}
