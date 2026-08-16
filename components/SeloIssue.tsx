"use client";

import { useEffect, useState } from "react";

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
    return () => { vivo = false; };
  }, [numero]);

  if (r.fase === "carregando") {
    return <span className="text-tinta/70">issue #{numero}</span>;
  }

  if (r.fase === "indisponivel") {
    return <span className="text-tinta/70">issue #{numero}</span>;
  }

  return (
    <a
      href={r.url}
      target="_blank"
      rel="noreferrer"
      className={`underline ${r.estado === "aberta" ? "text-ferro" : "text-musgo"}`}
    >
      issue #{numero} · {r.estado}
    </a>
  );
}
