// Camada de acesso à API do GitHub — só leitura, só roda no servidor.
// O token nunca é exposto ao cliente (não usa NEXT_PUBLIC_).

const BASE = "https://api.github.com";
const REVALIDATE_SEGUNDOS = 300; // 5 minutos, pra não estourar o rate limit

export function githubConfigurado(): boolean {
  return !!(process.env.GITHUB_TOKEN && process.env.GITHUB_ORG && process.env.GITHUB_REPO);
}

function repoBase(): string {
  return `${BASE}/repos/${process.env.GITHUB_ORG}/${process.env.GITHUB_REPO}`;
}

// Carrega o status HTTP junto com o erro, pra quem chama poder distinguir
// 401/404/409 (os que a equipe mais bate) de uma falha qualquer, sem
// precisar reabrir o texto cru da resposta do GitHub.
export class ErroGithub extends Error {
  status: number;
  constructor(status: number, corpo: string) {
    super(`GitHub API ${status}: ${corpo}`);
    this.name = "ErroGithub";
    this.status = status;
  }
}

async function chamarGithub<T>(caminho: string): Promise<T> {
  const resposta = await fetch(`${repoBase()}${caminho}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    next: { revalidate: REVALIDATE_SEGUNDOS },
  });
  if (!resposta.ok) {
    throw new ErroGithub(resposta.status, await resposta.text());
  }
  return resposta.json() as Promise<T>;
}

/**
 * Traduz uma falha da API do GitHub pro texto que a equipe vai ver na tela —
 * nunca o JSON cru da resposta. Cobre os três erros mais comuns (token,
 * repositório e repositório vazio); o resto cai num aviso genérico com o
 * status HTTP, sem despejar o corpo da resposta.
 */
export function mensagemErroGithub(erro: unknown): { status: number; mensagem: string } {
  if (erro instanceof ErroGithub) {
    switch (erro.status) {
      case 401:
        return {
          status: 401,
          mensagem: "Token do GitHub inválido ou expirado. Gere um novo e atualize GITHUB_TOKEN.",
        };
      case 404:
        return {
          status: 404,
          mensagem: "Repositório não encontrado, ou o token não tem acesso a ele. Confira GITHUB_ORG e GITHUB_REPO.",
        };
      case 409:
        return { status: 409, mensagem: "O repositório ainda não tem commits." };
      default:
        return {
          status: 502,
          mensagem: `Falha ao consultar o GitHub (HTTP ${erro.status}). Tenta de novo em alguns minutos.`,
        };
    }
  }
  return { status: 502, mensagem: "Falha ao consultar o GitHub. Tenta de novo em alguns minutos." };
}

export type CommitGithub = {
  sha: string;
  commit: { author: { name: string; date: string } | null; message: string };
  author: { login: string } | null;
};

export async function listarCommits(desde?: string): Promise<CommitGithub[]> {
  const query = desde ? `?since=${encodeURIComponent(desde)}&per_page=100` : "?per_page=100";
  return chamarGithub<CommitGithub[]>(`/commits${query}`);
}

export type PullRequestGithub = {
  number: number;
  title: string;
  state: "open" | "closed";
  user: { login: string } | null;
  created_at: string;
  closed_at: string | null;
  merged_at: string | null;
  requested_reviewers: { login: string }[];
  html_url: string;
};

export async function listarPullRequests(): Promise<PullRequestGithub[]> {
  return chamarGithub<PullRequestGithub[]>("/pulls?state=all&per_page=50");
}

export async function listarRevisores(numeroPR: number): Promise<string[]> {
  const revisoes = await chamarGithub<{ user: { login: string } | null }[]>(
    `/pulls/${numeroPR}/reviews`
  );
  return Array.from(new Set(revisoes.map((r) => r.user?.login).filter((l): l is string => !!l)));
}

export type StatusCI = { estado: "sucesso" | "falha" | "pendente" | "desconhecido"; url: string | null };

export async function statusCIUltimoPush(): Promise<StatusCI> {
  const commits = await chamarGithub<CommitGithub[]>("/commits?sha=main&per_page=1");
  const sha = commits[0]?.sha;
  if (!sha) return { estado: "desconhecido", url: null };

  const checks = await chamarGithub<{
    check_runs: { status: string; conclusion: string | null; html_url: string }[];
  }>(`/commits/${sha}/check-runs`);

  if (checks.check_runs.length === 0) return { estado: "desconhecido", url: null };

  const emAndamento = checks.check_runs.some((c) => c.status !== "completed");
  if (emAndamento) return { estado: "pendente", url: checks.check_runs[0].html_url };

  const falhou = checks.check_runs.some((c) => c.conclusion !== "success" && c.conclusion !== "neutral");
  return { estado: falhou ? "falha" : "sucesso", url: checks.check_runs[0].html_url };
}

export type IssueGithub = { number: number; state: "open" | "closed"; html_url: string; title: string };

export async function buscarIssue(numero: number): Promise<IssueGithub | null> {
  try {
    return await chamarGithub<IssueGithub>(`/issues/${numero}`);
  } catch {
    return null;
  }
}
