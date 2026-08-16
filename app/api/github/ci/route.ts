import { NextResponse } from "next/server";
import { githubConfigurado, mensagemErroGithub, statusCIUltimoPush } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!githubConfigurado()) {
    return NextResponse.json({ configurado: false });
  }

  try {
    const status = await statusCIUltimoPush();
    return NextResponse.json({ configurado: true, ...status });
  } catch (erro) {
    const { status, mensagem } = mensagemErroGithub(erro);
    return NextResponse.json({ configurado: true, erro: mensagem }, { status });
  }
}
