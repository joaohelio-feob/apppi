import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase-server";
import PainelSemana from "@/components/PainelSemana";
import { dataLocalISO } from "@/lib/datas";
import type { Tarefa } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Semana() {
  const supabase = criarClienteServidor();

  const agora = new Date();
  const hojeIso = dataLocalISO(agora);
  const fimIso = dataLocalISO(new Date(agora.getTime() + 7 * 86_400_000));

  const [{ data: tarefas }, { data: sessao }] = await Promise.all([
    supabase
      .from("tarefas")
      .select("id, titulo, descricao, escopo, frente_id, status, prioridade, prazo, inicio, local_entrega, subiu_git, issue_numero, observacoes, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, cor, unidade)")
      .eq("arquivada", false)
      .neq("status", "concluida")
      .order("prazo", { ascending: true, nullsFirst: false }),
    supabase.auth.getUser(),
  ]);

  const lista = (tarefas ?? []) as unknown as Tarefa[];
  const atrasadas = lista.filter((t) => t.prazo && t.prazo < hojeIso);
  const daSemana  = lista.filter((t) => t.prazo && t.prazo >= hojeIso && t.prazo <= fimIso);
  const depois    = lista.filter((t) => !t.prazo || t.prazo > fimIso);

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-musgo">
        {agora.toLocaleDateString("pt-BR", {
          weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo",
        })}
      </p>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        O que a equipe tem em mãos
      </h1>

      <div className="mt-8">
        <PainelSemana
          atrasadas={atrasadas}
          daSemana={daSemana}
          depois={depois}
          meuId={sessao.user?.id ?? null}
        />
      </div>

      <Link
        href="/tarefas"
        className="mt-10 inline-block bg-tinta px-4 py-2 text-sm font-semibold text-campo hover:bg-musgo"
      >
        Abrir o quadro
      </Link>
    </div>
  );
}
