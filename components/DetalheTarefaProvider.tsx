"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Frente, Membro, Tarefa } from "@/lib/types";
import DetalheTarefa from "./DetalheTarefa";

type Abertura = {
  tarefa: Tarefa;
  aoAtualizar?: () => void;
  membrosIniciais?: Membro[];
  frentesIniciais?: Frente[];
};
const Contexto = createContext<((abertura: Abertura) => void) | null>(null);

export function useDetalheTarefa() {
  const abrir = useContext(Contexto);
  if (!abrir)
    throw new Error("useDetalheTarefa precisa de DetalheTarefaProvider");
  return abrir;
}

// O painel sobrevive quando a tarefa muda de coluna, de grupo ou sai da fila.
export default function DetalheTarefaProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [abertura, setAbertura] = useState<Abertura | null>(null);
  return (
    <Contexto.Provider value={setAbertura}>
      {children}
      {abertura && (
        <DetalheTarefa
          {...abertura}
          key={abertura.tarefa.id}
          aoFechar={() => setAbertura(null)}
        />
      )}
    </Contexto.Provider>
  );
}
