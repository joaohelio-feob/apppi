import { ROTULOS_ATIVIDADE } from "@/lib/atividade";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase-server";
import PainelSemana from "@/components/PainelSemana";
import { dataLocalISO } from "@/lib/datas";
import type { Registro, Tarefa } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Semana() {
  const supabase = criarClienteServidor();

  const agora = new Date();
  const hojeIso = dataLocalISO(agora);
  const fimIso = dataLocalISO(new Date(agora.getTime() + 7 * 86_400_000));

  const [
    { data: tarefas, error: erroTarefas },
    { data: sessao },
    { data: atividade, error: erroAtividade },
    { data: estados, error: erroEstados },
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
    <div>
      {/* Título e data numa faixa só: a sobrancelha em mono maiúsculo acima
          do display gastava duas faixas para dizer uma coisa. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Semana
        </h1>
        <p className="font-mono text-xs text-tinta/70">
          {agora.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            timeZone: "America/Sao_Paulo",
          })}
        </p>
      </div>

      {erroTarefas && (
        <p role="alert" className="mt-4 border-l-2 border-trigo pl-3 text-sm">
          Não foi possível carregar as tarefas. Atualize a página para tentar
          novamente.
        </p>
      )}
      {!erroTarefas && (
        <div className="mt-6">
          <PainelSemana
            atrasadas={atrasadas}
            daSemana={daSemana}
            depois={depois}
            meuId={sessao.user?.id ?? null}
            revisoesPendentes={revisoesPendentes}
            erroRevisoes={!!erroEstados}
          />
        </div>
      )}

      <section
        className="mt-6 border-t border-linha pt-4"
        aria-labelledby="atividade-semana"
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            id="atividade-semana"
            className="font-display text-lg font-semibold"
          >
            Mudanças recentes
          </h2>
          <Link
            href="/relatorio"
            className="text-sm underline underline-offset-4"
          >
            Ver trilha
          </Link>
        </div>
        {erroAtividade ? (
          <p className="mt-2 text-sm text-tinta/70">
            Não foi possível carregar a atividade.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-linha">
            {((atividade ?? []) as Registro[]).map((r, i) => (
              <li
                key={`${r.em}-${i}`}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
              >
                <span>
                  <strong className="font-medium">{r.autor ?? "Equipe"}</strong>{" "}
                  · {ROTULOS_ATIVIDADE[r.acao] ?? r.acao} ·{" "}
                  {r.tarefa ?? "Atividade do projeto"}
                </span>
                <time
                  dateTime={r.em}
                  className="font-mono text-xs text-tinta/70"
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
            ))}
          </ul>
        )}
        {!erroAtividade && !atividade?.length && (
          <p className="mt-2 text-sm text-tinta/70">
            Nenhuma atividade registrada.
          </p>
        )}
      </section>
      <Link
        href="/tarefas"
        className="mt-6 inline-block text-sm text-tinta/70 underline underline-offset-4"
      >
        Abrir o quadro
      </Link>
    </div>
  );
}
