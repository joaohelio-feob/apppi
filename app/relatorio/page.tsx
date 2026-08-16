import { criarClienteServidor } from "@/lib/supabase-server";
import { dataLocalDeTimestamp, dataLocalISO } from "@/lib/datas";
import { githubConfigurado, listarCommits, type CommitGithub } from "@/lib/github";
import { UNIDADES, UNIDADES_FRENTE, responsaveisDe, type Frente, type Membro, type Registro, type Tarefa } from "@/lib/types";
import BotaoExportarCSV from "@/components/BotaoExportarCSV";
import BotaoExportarPDF from "@/components/BotaoExportarPDF";

const COLUNAS_CSV = [
  "em", "autor", "papel", "acao", "campo", "valor_antigo", "valor_novo",
  "tarefa", "status_atual", "escopo", "unidade", "frente", "frente_unidade",
];

export const dynamic = "force-dynamic";

const VERBO: Record<string, string> = {
  criou: "abriu a tarefa",
  mudou_status: "moveu para",
  reatribuiu: "passou a responsabilidade",
  mudou_prazo: "remarcou o prazo para",
  editou: "reescreveu",
  mudou_git: "marcou subiu_git como",
  arquivou: "arquivou a tarefa",
  desarquivou: "desarquivou a tarefa",
  removeu: "apagou a tarefa",
};

export default async function Trilha() {
  const supabase = criarClienteServidor();

  const [{ data }, { data: membrosData }, { data: frentesData }, { data: concluidasData }, { data: historicoTotal }] =
    await Promise.all([
      supabase.from("relatorio_atividades").select("*").order("em", { ascending: false }).limit(500),
      supabase.from("membros").select("id, nome, papel, frente_id"),
      supabase.from("frentes").select("id, nome, unidade"),
      supabase
        .from("tarefas")
        .select("*, responsaveis:tarefa_responsaveis(membro:membros(id, nome, papel)), frentes(id, nome, unidade)")
        .eq("status", "concluida"),
      supabase.from("historico").select("autor_id").limit(10000),
    ]);

  const registros = (data ?? []) as Registro[];
  const membros = (membrosData ?? []) as Membro[];
  const frentes = (frentesData ?? []) as Frente[];
  const concluidas = (concluidasData ?? []) as Tarefa[];

  const participacaoPorAutor = (historicoTotal ?? []).reduce<Record<string, number>>((acc, h) => {
    if (!h.autor_id) return acc;
    acc[h.autor_id] = (acc[h.autor_id] ?? 0) + 1;
    return acc;
  }, {});

  const resumoPorPessoa = membros.map((m) => {
    const dela = concluidas.filter((t) => responsaveisDe(t).some((r) => r.id === m.id));
    const individuais = dela.filter((t) => t.escopo === "individual");
    const deFrente = dela.filter((t) => t.escopo === "frente");
    const unidades = Array.from(new Set(dela.map((t) => UNIDADES.find((u) => u.id === t.unidade)?.nome ?? t.unidade)));
    const frenteDela = frentes.find((f) => f.id === m.frente_id);
    return {
      nome: m.nome,
      frente: frenteDela?.nome ?? "sem frente",
      unidadeFrente: UNIDADES_FRENTE.find((u) => u.id === frenteDela?.unidade)?.nome ?? null,
      individuais: individuais.length,
      deFrente: deFrente.length,
      unidades,
      participacao: participacaoPorAutor[m.id] ?? 0,
    };
  });

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

  // Cruza com o GitHub: o que o painel registrou vs. o que foi commitado de fato.
  let porDiaGithub: Record<string, CommitGithub[]> = {};
  if (githubConfigurado()) {
    try {
      const commits = await listarCommits(new Date(Date.now() - 90 * 86_400_000).toISOString());
      porDiaGithub = commits.reduce<Record<string, CommitGithub[]>>((acc, c) => {
        const quando = c.commit.author?.date;
        if (!quando) return acc;
        const dia = dataLocalDeTimestamp(quando);
        (acc[dia] ??= []).push(c);
        return acc;
      }, {});
    } catch {
      // GitHub fora do ar não pode derrubar a Trilha — ela é a prova principal.
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 print:block">
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
        <div className="flex gap-2 print:hidden">
          <BotaoExportarCSV
            linhas={registros}
            colunas={COLUNAS_CSV}
            nomeArquivo={`trilha-pi-${dataLocalISO()}.csv`}
            rotulo="Baixar CSV para o professor"
          />
          <BotaoExportarPDF />
        </div>
      </div>

      <p className="hidden font-display text-lg font-bold print:block">
        Caderno de Campo · PI 2026 — Trilha de atividades
      </p>

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

      <section className="mt-8 overflow-x-auto border border-linha">
        <h2 className="border-b border-linha bg-casca px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-tinta/60">
          Resumo por pessoa
        </h2>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-linha bg-casca font-mono text-[11px] uppercase tracking-wide text-tinta/60">
              <th className="px-3 py-2 text-left">Pessoa</th>
              <th className="px-3 py-2 text-left">Frente</th>
              <th className="px-3 py-2 text-left">Concluídas individuais</th>
              <th className="px-3 py-2 text-left">Concluídas de frente</th>
              <th className="px-3 py-2 text-left">Unidades trabalhadas</th>
              <th className="px-3 py-2 text-left">Participação na trilha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linha">
            {resumoPorPessoa.map((p) => (
              <tr key={p.nome}>
                <td className="px-3 py-2 font-semibold">{p.nome}</td>
                <td className="px-3 py-2 text-tinta/70">
                  {p.frente}
                  {p.unidadeFrente && <span className="text-tinta/50"> · {p.unidadeFrente}</span>}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{p.individuais}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.deFrente}</td>
                <td className="px-3 py-2 text-xs text-tinta/70">{p.unidades.join(", ") || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.participacao}</td>
              </tr>
            ))}
            {resumoPorPessoa.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-tinta/50">
                  Ninguém cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
                    {r.unidade && (
                      <span className="border border-linha px-1 py-0.5 font-mono text-[10px] uppercase text-tinta/50">
                        {UNIDADES.find((u) => u.id === r.unidade)?.nome ?? r.unidade}
                      </span>
                    )}
                    {r.escopo === "frente" && r.frente && (
                      <span className="border border-musgo px-1 py-0.5 font-mono text-[10px] uppercase text-musgo">
                        frente · {r.frente}
                        {r.frente_unidade && ` (${UNIDADES.find((u) => u.id === r.frente_unidade)?.nome ?? r.frente_unidade})`}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {porDiaGithub[dia]?.length > 0 && (
              <div className="mt-3 border-l border-linha pl-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-tinta/40">
                  No GitHub, no mesmo dia
                </p>
                <ul className="mt-1 space-y-1">
                  {porDiaGithub[dia].map((c) => (
                    <li key={c.sha} className="text-xs text-tinta/60">
                      <span className="font-mono">{c.author?.login ?? c.commit.author?.name ?? "—"}</span>
                      {" · "}
                      {c.commit.message.split("\n")[0]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
