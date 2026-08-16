import { NextResponse } from "next/server";
import { githubConfigurado, listarCommits, mensagemErroGithub } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!githubConfigurado()) {
    return NextResponse.json({ configurado: false });
  }

  const dias = Number(new URL(request.url).searchParams.get("dias") ?? "30");
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();

  try {
    const commits = await listarCommits(desde);
    const porAutor: Record<string, number> = {};
    for (const c of commits) {
      const nome = c.author?.login ?? c.commit.author?.name ?? "desconhecido";
      porAutor[nome] = (porAutor[nome] ?? 0) + 1;
    }
    return NextResponse.json({ configurado: true, total: commits.length, porAutor });
  } catch (erro) {
    const { status, mensagem } = mensagemErroGithub(erro);
    return NextResponse.json({ configurado: true, erro: mensagem }, { status });
  }
}
