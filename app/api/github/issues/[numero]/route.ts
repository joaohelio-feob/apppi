import { NextResponse } from "next/server";
import { buscarIssue, githubConfigurado } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { numero: string } }) {
  if (!githubConfigurado()) {
    return NextResponse.json({ configurado: false });
  }

  const numero = Number(params.numero);
  if (!Number.isInteger(numero) || numero <= 0) {
    return NextResponse.json({ configurado: true, erro: "Número de issue inválido." }, { status: 400 });
  }

  const issue = await buscarIssue(numero);
  if (!issue) {
    return NextResponse.json({ configurado: true, encontrada: false });
  }
  return NextResponse.json({
    configurado: true,
    encontrada: true,
    estado: issue.state === "open" ? "aberta" : "fechada",
    url: issue.html_url,
    titulo: issue.title,
  });
}
