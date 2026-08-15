import { criarClienteServidor } from "@/lib/supabase-server";
import { dataLocalDeTimestamp } from "@/lib/datas";
import type { Registro } from "@/lib/types";
import BotaoExportar from "@/components/BotaoExportar";

export const dynamic = "force-dynamic";

const VERBO: Record<string, string> = {
  criou: "abriu a tarefa",
  mudou_status: "moveu para",
  reatribuiu: "passou a responsabilidade",
  mudou_prazo: "remarcou o prazo para",
  editou: "reescreveu",
  removeu: "apagou a tarefa",
};

export default async function Trilha() {
  const supabase = criarClienteServidor();

  const { data } = await supabase
    .from("relatorio_atividades")
    .select("*")
    .order("em", { ascending: false })
    .limit(500);

  const registros = (data ?? []) as Registro[];

  // Quantos registros cada pessoa gerou — a divisão de trabalho, em números.
  const porPessoa = registros.reduce<Record<string, number>>((acc, r) => {
    const nome = r.autor ?? "desconhecido";
    acc[nome] = (acc[nome] ?? 0) + 1;
    return acc;
  }, {});

  const porDia = registros.reduce<Record<string, Registro[]>>((acc, r) => {
    const dia = dataLocalDeTimestamp(r.em);
    (acc[dia] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-musgo">
            Trilha de atividades
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
            Tudo que aconteceu, na ordem
          </h1>
          <p className="mt-2 max-w-prose text-sm text-tinta/70">
            Cada linha foi gravada pelo banco no momento em que a ação ocorreu. Ninguém
            digita nem edita esta página — é o registro corrido do semestre.
          </p>
        </div>
        <BotaoExportar />
      </div>

      <section className="mt-8 border border-linha bg-casca p-4">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-tinta/60">
          Registros por integrante
        </h2>
        <div className="mt-3 space-y-2">
          {Object.entries(porPessoa)
            .sort((a, b) => b[1] - a[1])
            .map(([nome, total]) => {
              const maior = Math.max(...Object.values(porPessoa));
              return (
                <div key={nome} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-sm">{nome}</span>
                  <div className="h-3 flex-1 bg-linha">
                    <div className="h-full bg-musgo" style={{ width: `${(total / maior) * 100}%` }} />
                  </div>
                  <span className="w-10 text-right font-mono text-xs text-tinta/60">{total}</span>
                </div>
              );
            })}
          {registros.length === 0 && (
            <p className="text-sm text-tinta/50">
              Ainda não há registros. Crie a primeira tarefa no quadro e ela aparece aqui.
            </p>
          )}
        </div>
      </section>

      <div className="mt-10 space-y-8">
        {Object.entries(porDia).map(([dia, itens]) => (
          <section key={dia}>
            <h2 className="sticky top-0 z-10 -mx-1 bg-campo/90 px-1 py-1 font-mono text-xs uppercase tracking-widest text-musgo backdrop-blur">
              {new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", {
                weekday: "short", day: "2-digit", month: "short", year: "numeric",
              })}
            </h2>

            <ol className="mt-3 border-l border-linha pl-4">
              {itens.map((r, i) => (
                <li key={i} className="relative py-2">
                  <span className="absolute -left-[21px] top-3.5 h-2 w-2 bg-musgo" />
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <time className="font-mono text-[11px] text-tinta/50">
                      {new Date(r.em).toLocaleTimeString("pt-BR", {
                        hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
                      })}
                    </time>
                    <span className="text-sm font-semibold">{r.autor ?? "—"}</span>
                    <span className="text-sm text-tinta/70">{VERBO[r.acao] ?? r.acao}</span>
                    {r.valor_novo && r.acao !== "criou" && (
                      <span className="bg-casca px-1.5 font-mono text-[11px]">{r.valor_novo}</span>
                    )}
                    {r.tarefa && (
                      <span className="text-sm">
                        em <strong className="font-semibold">{r.tarefa}</strong>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
