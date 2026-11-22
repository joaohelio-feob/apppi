"use client";

import { useEffect, useState } from "react";
import { IconeGit } from "./ui/Icones";

type Resultado =
  | { fase: "carregando" }
  | { fase: "indisponivel" }
  | { fase: "pronta"; estado: "aberta" | "fechada"; url: string };

export default function SeloIssue({ numero }: { numero: number }) {
  const [r, setR] = useState<Resultado>({ fase: "carregando" });

  useEffect(() => {
    let vivo = true;
    fetch(`/api/github/issues/${numero}`)
      .then((res) => res.json())
      .then((d) => {
        if (!vivo) return;
        if (!d.configurado || !d.encontrada) {
          setR({ fase: "indisponivel" });
          return;
        }
        setR({ fase: "pronta", estado: d.estado, url: d.url });
      })
      .catch(() => vivo && setR({ fase: "indisponivel" }));
    return () => {
      vivo = false;
    };
  }, [numero]);

  if (r.fase === "carregando" || r.fase === "indisponivel") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-linha bg-casca px-2 py-0.5 font-mono text-xs text-tinta/70">
        <IconeGit className="h-3 w-3" />#{numero}
      </span>
    );
  }

  return (
    <a
      href={r.url}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs font-semibold transition-colors duration-micro ease-entrada ${
        r.estado === "aberta"
          ? "border-ferro bg-ferro/10 text-ferro hover:bg-ferro hover:text-campo"
          : "border-musgo bg-musgo/15 text-musgo hover:bg-musgo hover:text-campo"
      }`}
    >
      <IconeGit className="h-3 w-3" />
      issue #{numero} · {r.estado}
    </a>
  );
}
