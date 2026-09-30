"use client";
import { useEffect, useRef } from "react";
import { criarClienteNavegador } from "./supabase-browser";

export function useAtualizacaoTarefas(nome: string, aoAtualizar: () => void) {
  const atualizar = useRef(aoAtualizar);
  atualizar.current = aoAtualizar;
  useEffect(() => {
    const supabase = criarClienteNavegador();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ativo = true;
    const agendar = () => {
      if (!ativo) return;
      clearTimeout(timer);
      timer = setTimeout(() => atualizar.current(), 250);
    };
    const canal = supabase.channel(nome);
    for (const tabela of [
      "tarefas",
      "tarefa_responsaveis",
      "entregas",
      "revisoes",
    ]) {
      canal.on(
        "postgres_changes",
        { event: "*", schema: "public", table: tabela },
        agendar,
      );
    }
    canal.subscribe();
    return () => {
      ativo = false;
      clearTimeout(timer);
      void supabase.removeChannel(canal);
    };
  }, [nome]);
}
