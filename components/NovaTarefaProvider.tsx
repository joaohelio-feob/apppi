"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import type { Frente, Membro } from "@/lib/types";
import Dialogo from "./ui/Dialogo";
import AvisoErro from "./ui/AvisoErro";
import FormularioTarefa from "./FormularioTarefa";
import { useToast } from "./ToastProvider";

type NovaTarefaContexto = { abrir: () => void };

const NovaTarefaContext = createContext<NovaTarefaContexto | null>(null);

export function useNovaTarefa() {
  const ctx = useContext(NovaTarefaContext);
  if (!ctx)
    throw new Error(
      "useNovaTarefa precisa estar dentro de <NovaTarefaProvider>",
    );
  return ctx;
}

export default function NovaTarefaProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [carregandoListas, setCarregandoListas] = useState(true);
  const [erroListas, setErroListas] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const { avisar } = useToast();
  const caminho = usePathname();
  const emLogin = caminho === "/login";

  const abrir = useCallback(() => {
    setCarregandoListas(true);
    setErroListas(false);
    setAberta(true);
  }, []);

  useEffect(() => {
    if (!aberta) return;
    let ativo = true;
    setCarregandoListas(true);
    setErroListas(false);
    const supabase = criarClienteNavegador();
    Promise.all([
      supabase
        .from("membros")
        .select("id, nome, papel, frente_id")
        .order("nome"),
      supabase.from("frentes").select("id, nome").order("nome"),
    ]).then(([m, f]) => {
      if (!ativo) return;
      setCarregandoListas(false);
      setErroListas(!!(m.error || f.error));
      if (m.error || f.error) return;
      setMembros((m.data ?? []) as Membro[]);
      setFrentes((f.data ?? []) as Frente[]);
    });
    return () => {
      ativo = false;
    };
  }, [aberta, tentativa]);

  // Atalho "n" abre o formulário de qualquer página, exceto quando o usuário
  // está digitando em outro campo.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      const digitando =
        !!alvo &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName) ||
          alvo.isContentEditable);
      if (
        e.key.toLowerCase() === "n" &&
        !document.querySelector('dialog[open], [aria-modal="true"]') &&
        !digitando &&
        !emLogin &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        abrir();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [emLogin, abrir]);

  return (
    <NovaTarefaContext.Provider value={{ abrir }}>
      {children}
      {aberta && !emLogin && (carregandoListas || erroListas) && (
        <Dialogo titulo="Nova tarefa" aoFechar={() => setAberta(false)}>
          {erroListas ? (
            <AvisoErro
              mensagem="Não foi possível carregar responsáveis e frentes."
              aoTentar={() => setTentativa((n) => n + 1)}
            />
          ) : (
            <p role="status">Carregando responsáveis e frentes…</p>
          )}
          <button
            className="botao botao-secundario mt-3"
            onClick={() => setAberta(false)}
          >
            Fechar
          </button>
        </Dialogo>
      )}
      {aberta && !emLogin && !carregandoListas && !erroListas && (
        <FormularioTarefa
          membros={membros}
          frentes={frentes}
          autoFoco
          aoFechar={() => setAberta(false)}
          aoSalvar={() => {
            avisar("Tarefa criada.", "info");
            router.refresh();
          }}
        />
      )}
    </NovaTarefaContext.Provider>
  );
}
