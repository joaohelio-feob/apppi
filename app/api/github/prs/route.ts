import { NextResponse } from "next/server";
import { githubConfigurado, listarPullRequests, listarRevisores } from "@/lib/github";

export const dynamic = "force-dynamic";

const LIMITE_COM_REVISORES = 20; // evita N+1 excessivo na API do GitHub

export async function GET() {
  if (!githubConfigurado()) {
    return NextResponse.json({ configurado: false });
  }

  try {
    const prs = await listarPullRequests();

    const comRevisores = await Promise.all(
      prs.slice(0, LIMITE_COM_REVISORES).map(async (pr) => ({
        numero: pr.number,
        titulo: pr.title,
        estado: pr.merged_at ? "mesclado" : pr.state === "open" ? "aberto" : "fechado",
        autor: pr.user?.login ?? null,
        criadoEm: pr.created_at,
        fechadoEm: pr.closed_at,
        url: pr.html_url,
        revisores: await listarRevisores(pr.number).catch(() => []),
      }))
    );

    return NextResponse.json({
      configurado: true,
      abertos: prs.filter((p) => p.state === "open").length,
      fechados: prs.filter((p) => p.state === "closed").length,
      pullRequests: comRevisores,
    });
  } catch (erro) {
    return NextResponse.json(
      { configurado: true, erro: erro instanceof Error ? erro.message : "Falha ao consultar o GitHub." },
      { status: 502 }
    );
  }
}
