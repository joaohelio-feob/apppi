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
    throw new Error(`GitHub API ${resposta.status}: ${await resposta.text()}`);
  }
  return resposta.json() as Promise<T>;
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
