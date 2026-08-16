"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import type { Frente, Membro } from "@/lib/types";
import FormularioTarefa from "./FormularioTarefa";
import { useToast } from "./ToastProvider";

type NovaTarefaContexto = { abrir: () => void };

const NovaTarefaContext = createContext<NovaTarefaContexto | null>(null);

export function useNovaTarefa() {
  const ctx = useContext(NovaTarefaContext);
  if (!ctx) throw new Error("useNovaTarefa precisa estar dentro de <NovaTarefaProvider>");
  return ctx;
}

export default function NovaTarefaProvider({ children }: { children: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const { avisar } = useToast();
  const caminho = usePathname();
  const emLogin = caminho === "/login";

  const abrir = useCallback(() => setAberta(true), []);

  useEffect(() => {
    if (!aberta) return;
    const supabase = criarClienteNavegador();
    supabase.from("membros").select("id, nome, papel, frente_id").order("nome")
      .then(({ data }) => setMembros((data ?? []) as Membro[]));
    supabase.from("frentes").select("id, nome").order("nome")
      .then(({ data }) => setFrentes((data ?? []) as Frente[]));
  }, [aberta]);

  // Atalho "n" abre o formulário de qualquer página, exceto quando o usuário
  // está digitando em outro campo.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      const digitando =
        !!alvo && (["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName) || alvo.isContentEditable);
      if (e.key === "n" && !digitando && !emLogin && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setAberta(true);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [emLogin]);

  return (
    <NovaTarefaContext.Provider value={{ abrir }}>
      {children}
      {aberta && !emLogin && (
        <FormularioTarefa
          membros={membros}
          frentes={frentes}
          autoFoco
          aoFechar={() => setAberta(false)}
          aoSalvar={() => avisar("Tarefa criada.", "info")}
        />
      )}
    </NovaTarefaContext.Provider>
  );
}
