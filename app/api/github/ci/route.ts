import { NextResponse } from "next/server";
import { githubConfigurado, statusCIUltimoPush } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!githubConfigurado()) {
    return NextResponse.json({ configurado: false });
  }

  try {
    const status = await statusCIUltimoPush();
    return NextResponse.json({ configurado: true, ...status });
  } catch (erro) {
    return NextResponse.json(
      { configurado: true, erro: erro instanceof Error ? erro.message : "Falha ao consultar o GitHub." },
      { status: 502 }
    );
  }
}
