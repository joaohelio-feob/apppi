import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase-server";
import CartaoTarefa from "@/components/CartaoTarefa";
import type { Tarefa } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Semana() {
  const supabase = criarClienteServidor();

  const hoje = new Date();
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + 7);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const { data: tarefas } = await supabase
    .from("tarefas")
    .select("*, membros:responsavel_id(id, nome, papel)")
    .neq("status", "concluida")
    .order("prazo", { ascending: true, nullsFirst: false });

  const lista = (tarefas ?? []) as Tarefa[];
  const atrasadas = lista.filter((t) => t.prazo && t.prazo < iso(hoje));
  const daSemana  = lista.filter((t) => t.prazo && t.prazo >= iso(hoje) && t.prazo <= iso(fim));
  const depois    = lista.filter((t) => !t.prazo || t.prazo > iso(fim));

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-musgo">
        {hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
      </p>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        O que a equipe tem em mãos
      </h1>

      <div className="mt-8 space-y-10">
        <Secao titulo="Passou do prazo" itens={atrasadas} vazio="Nada atrasado. Bom sinal." />
        <Secao titulo="Próximos 7 dias" itens={daSemana} vazio="A semana está livre — hora de puxar algo da fila." />
        <Secao titulo="Mais adiante" itens={depois} vazio="Sem tarefas na fila." />
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

function Secao({ titulo, itens, vazio }: { titulo: string; itens: Tarefa[]; vazio: string }) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-2 border-b border-linha pb-1 font-display text-lg font-semibold">
        {titulo}
        <span className="font-mono text-xs font-normal text-tinta/50">{itens.length}</span>
      </h2>
      {itens.length === 0 ? (
        <p className="text-sm text-tinta/50">{vazio}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((t) => <CartaoTarefa key={t.id} tarefa={t} />)}
        </div>
      )}
    </section>
  );
}
