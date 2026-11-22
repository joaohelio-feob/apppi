import { ROTULOS_ATIVIDADE } from "@/lib/atividade";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase-server";
import PainelSemana from "@/components/PainelSemana";
import { IconeSetaDireita, IconeTrilha } from "@/components/ui/Icones";
import { dataLocalISO } from "@/lib/datas";
import { iniciaisDe, type Registro, type Tarefa } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Semana() {
  const supabase = criarClienteServidor();

  const agora = new Date();
  const hojeIso = dataLocalISO(agora);
  const fimIso = dataLocalISO(new Date(agora.getTime() + 7 * 86_400_000));
  const dataHoje = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });

  const [
    { data: tarefas, error: erroTarefas },
    { data: sessao },
    { data: atividade, error: erroAtividade },
    { data: estados, error: erroEstados },
    { count: totalConcluidas },
  ] = await Promise.all([
    supabase
      .from("tarefas")
      .select(
        "id, titulo, descricao, escopo, frente_id, status, prioridade, prazo, inicio, local_entrega, subiu_git, issue_numero, observacoes, revisor_id, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, cor, unidade)",
      )
      .eq("arquivada", false)
      .neq("status", "concluida")
      .order("prazo", { ascending: true, nullsFirst: false }),
    supabase.auth.getUser(),
    supabase
      .from("relatorio_atividades")
      .select("em, autor, acao, tarefa")
      .order("em", { ascending: false })
      .limit(5),
    supabase.from("tarefas_estado_entrega").select("tarefa_id, pendente_git"),
    supabase
      .from("tarefas")
      .select("id", { count: "exact", head: true })
      .eq("arquivada", false)
      .eq("status", "concluida"),
  ]);

  const lista = (tarefas ?? []) as unknown as Tarefa[];
  const prontasParaRevisao = new Set(
    (estados ?? []).filter((e) => !e.pendente_git).map((e) => e.tarefa_id),
  );
  const revisoesPendentes = lista.filter(
    (t) => t.status === "revisao" && prontasParaRevisao.has(t.id),
  );
  const atrasadas = lista.filter((t) => t.prazo && t.prazo < hojeIso);
  const daSemana = lista.filter(
    (t) => t.prazo && t.prazo >= hojeIso && t.prazo <= fimIso,
  );
  const depois = lista.filter((t) => !t.prazo || t.prazo > fimIso);

  return (
    <div className="space-y-6">
      {erroTarefas ? (
        <div className="space-y-4">
          <div className="rounded-xl border-b-4 border-b-broto bg-tinta p-6 text-campo shadow-destaque">
            <p className="font-mono text-xs text-campo/85">{dataHoje}</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
              Semana do Projeto Integrador
            </h1>
          </div>
          <p
            role="alert"
            className="rounded-xl border border-trigo bg-trigo/15 px-4 py-3 text-sm text-tinta"
          >
            Não foi possível carregar as tarefas. Atualize a página para tentar
            novamente.
          </p>
        </div>
      ) : (
        <PainelSemana
          atrasadas={atrasadas}
          daSemana={daSemana}
          depois={depois}
          meuId={sessao.user?.id ?? null}
          revisoesPendentes={revisoesPendentes}
          erroRevisoes={!!erroEstados}
          totalConcluidas={totalConcluidas ?? 0}
          dataHoje={dataHoje}
        />
      )}

      <section
        className="cartao p-4 sm:p-5"
        aria-labelledby="atividade-semana"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-casca text-musgo">
              <IconeTrilha className="h-4 w-4" />
            </span>
            <div>
              <h2
                id="atividade-semana"
                className="font-display text-lg font-bold text-tinta"
              >
                Mudanças recentes
              </h2>
              <p className="text-xs text-tinta/70">
                Últimas ações gravadas automaticamente pelo banco na Trilha.
              </p>
            </div>
          </div>
          <Link
            href="/relatorio"
            className="botao botao-secundario min-h-8 px-3 py-1 text-xs"
          >
            Ver trilha completa
            <IconeSetaDireita className="h-3.5 w-3.5" />
          </Link>
        </div>

        {erroAtividade ? (
          <p className="mt-3 text-sm text-tinta/70">
            Não foi possível carregar a atividade.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-linha/80">
            {((atividade ?? []) as Registro[]).map((r, i) => {
              const autor = r.autor ?? "Equipe";
              return (
                <li
                  key={`${r.em}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-musgo font-mono text-xs font-semibold text-campo"
                    >
                      {iniciaisDe(autor)}
                    </span>
                    <span className="min-w-0">
                      <strong className="font-semibold text-tinta">
                        {autor}
                      </strong>{" "}
                      <span className="inline-block rounded-full bg-casca px-2 py-0.5 text-xs font-medium text-tinta">
                        {ROTULOS_ATIVIDADE[r.acao] ?? r.acao}
                      </span>{" "}
                      <span className="text-tinta/70">
                        {r.tarefa ?? "Atividade do projeto"}
                      </span>
                    </span>
                  </div>
                  <time
                    dateTime={r.em}
                    className="rounded bg-campo px-2 py-0.5 font-mono text-xs text-tinta/70"
                  >
                    {new Date(r.em).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "America/Sao_Paulo",
                    })}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
        {!erroAtividade && !atividade?.length && (
          <p className="mt-3 text-sm text-tinta/70">
            Nenhuma atividade registrada ainda.
          </p>
        )}
      </section>
    </div>
  );
}
