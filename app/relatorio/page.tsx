import { criarClienteServidor } from "@/lib/supabase-server";
import { dataLocalDeTimestamp, dataLocalISO } from "@/lib/datas";
import {
  githubConfigurado,
  listarCommits,
  type CommitGithub,
} from "@/lib/github";
import {
  UNIDADES_FRENTE,
  iniciaisDe,
  responsaveisDe,
  type Frente,
  type Membro,
  type Registro,
  type Tarefa,
} from "@/lib/types";
import BotaoExportarCSV from "@/components/BotaoExportarCSV";
import BotaoExportarPDF from "@/components/BotaoExportarPDF";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import {
  IconeCheck,
  IconeEquipe,
  IconeGit,
  IconeTrilha,
} from "@/components/ui/Icones";

const COLUNAS_CSV = [
  "em",
  "autor",
  "papel",
  "acao",
  "campo",
  "valor_antigo",
  "valor_novo",
  "tarefa",
  "status_atual",
  "escopo",
  "frente",
  "frente_unidade",
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

  const [
    { data },
    { data: membrosData },
    { data: concluidasData },
    { data: historicoTotal },
  ] = await Promise.all([
    supabase
      .from("relatorio_atividades")
      .select("*")
      .order("em", { ascending: false })
      .limit(500),
    supabase
      .from("membros")
      .select("id, nome, papel, frente_id, frentes(id, nome, unidade)"),
    supabase
      .from("tarefas")
      .select(
        "id, escopo, responsaveis:tarefa_responsaveis(membro:membros(id)), frentes(unidade)",
      )
      .eq("status", "concluida"),
    supabase.from("historico").select("autor_id").limit(10000),
  ]);

  const registros = (data ?? []) as Registro[];
  const membros = (membrosData ?? []) as unknown as (Membro & {
    frentes?: Frente | null;
  })[];
  const concluidas = (concluidasData ?? []) as unknown as Tarefa[];

  const participacaoPorAutor = (historicoTotal ?? []).reduce<
    Record<string, number>
  >((acc, h) => {
    if (!h.autor_id) return acc;
    acc[h.autor_id] = (acc[h.autor_id] ?? 0) + 1;
    return acc;
  }, {});

  const resumoPorPessoa = membros.map((m) => {
    const dela = concluidas.filter((t) =>
      responsaveisDe(t).some((r) => r.id === m.id),
    );
    const individuais = dela.filter((t) => t.escopo === "individual");
    const deFrente = dela.filter((t) => t.escopo === "frente");
    const unidades = Array.from(
      new Set(
        dela
          .map((t) => t.frentes?.unidade)
          .filter((u): u is NonNullable<typeof u> => !!u)
          .map((u) => UNIDADES_FRENTE.find((x) => x.id === u)?.nome ?? u),
      ),
    );
    const frenteDela = m.frentes;
    return {
      nome: m.nome,
      frente: frenteDela?.nome ?? "sem frente",
      unidadeFrente:
        UNIDADES_FRENTE.find((u) => u.id === frenteDela?.unidade)?.nome ?? null,
      individuais: individuais.length,
      deFrente: deFrente.length,
      unidades,
      participacao: participacaoPorAutor[m.id] ?? 0,
    };
  });

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

  let porDiaGithub: Record<string, CommitGithub[]> = {};
  if (githubConfigurado()) {
    try {
      const commits = await listarCommits(
        new Date(Date.now() - 90 * 86_400_000).toISOString(),
      );
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
      <div className="print:hidden">
        <CabecalhoPagina
          categoria="Evidência oficial · Imutável"
          icone={<IconeTrilha className="h-3.5 w-3.5 text-musgo" />}
          titulo="Tudo que aconteceu, na ordem"
          descricao="Cada linha foi gravada automaticamente pelo banco de dados no instante em que a ação ocorreu. Ninguém edita nem apaga esta trilha."
          acoes={
            <>
              <BotaoExportarCSV
                linhas={registros}
                colunas={COLUNAS_CSV}
                nomeArquivo={`trilha-pi-${dataLocalISO()}.csv`}
                rotulo="Baixar CSV para o professor"
              />
              <BotaoExportarPDF />
            </>
          }
        />
      </div>

      <p className="hidden font-display text-lg font-bold print:block">
        Caderno de Campo · PI 2026 — Trilha de atividades
      </p>

      {/* 3 KPIs */}
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="cartao border-l-4 border-l-musgo p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-tinta/70">
            <IconeTrilha className="h-3.5 w-3.5 text-musgo" />
            Eventos na trilha (últimos 500)
          </p>
          <p className="mt-1 font-display text-3xl font-extrabold text-tinta">
            {registros.length}
          </p>
        </div>
        <div className="cartao border-l-4 border-l-ferro p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-tinta/70">
            <IconeEquipe className="h-3.5 w-3.5 text-ferro" />
            Integrantes cadastrados
          </p>
          <p className="mt-1 font-display text-3xl font-extrabold text-tinta">
            {membros.length}
          </p>
        </div>
        <div className="cartao border-l-4 border-l-broto p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-tinta/70">
            <IconeCheck className="h-3.5 w-3.5 text-musgo" />
            Tarefas concluídas
          </p>
          <p className="mt-1 font-display text-3xl font-extrabold text-tinta">
            {concluidas.length}
          </p>
        </div>
      </section>

      <section className="cartao mb-6 p-5">
        <h2 className="mb-4 border-b border-linha pb-2 font-display text-base font-bold text-tinta">
          Registros por integrante
        </h2>
        <div className="space-y-2.5">
          {Object.entries(porPessoa)
            .sort((a, b) => b[1] - a[1])
            .map(([nome, total]) => {
              const maior = Math.max(...Object.values(porPessoa));
              return (
                <div key={nome} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 truncate text-sm font-medium text-tinta">
                    {nome}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-linha">
                    <div
                      className="h-full rounded-full bg-musgo"
                      style={{ width: `${(total / maior) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-xs font-semibold text-tinta">
                    {total}
                  </span>
                </div>
              );
            })}
          {registros.length === 0 && (
            <p className="text-sm text-tinta/70">
              Ainda não há registros. Crie a primeira tarefa no quadro e ela
              aparece aqui.
            </p>
          )}
        </div>
      </section>

      <section className="cartao mb-8 max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible">
        <h2 className="border-b border-linha bg-casca px-4 py-3 font-display text-sm font-bold text-tinta">
          Resumo por pessoa
        </h2>
        <table className="tabela-edicao min-w-[640px]">
          <thead>
            <tr className="border-b border-linha bg-casca font-display text-xs font-semibold text-tinta/70">
              <th className="px-4 py-2.5 text-left">Pessoa</th>
              <th className="px-4 py-2.5 text-left">Frente</th>
              <th className="px-4 py-2.5 text-left">Concluídas individuais</th>
              <th className="px-4 py-2.5 text-left">Concluídas de frente</th>
              <th className="px-4 py-2.5 text-left">Unidades trabalhadas</th>
              <th className="px-4 py-2.5 text-left">Participação na trilha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linha/80">
            {resumoPorPessoa.map((p) => (
              <tr key={p.nome}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-musgo font-mono text-xs font-semibold text-campo"
                    >
                      {iniciaisDe(p.nome)}
                    </span>
                    <span className="font-semibold text-tinta">{p.nome}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-tinta/70">
                  {p.frente}
                  {p.unidadeFrente && (
                    <span className="text-tinta/70"> · {p.unidadeFrente}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-tinta">
                  {p.individuais}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-tinta">
                  {p.deFrente}
                </td>
                <td className="px-4 py-2.5 text-xs text-tinta/70">
                  {p.unidades.join(", ") || "—"}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-tinta">
                  {p.participacao}
                </td>
              </tr>
            ))}
            {resumoPorPessoa.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-tinta/70"
                >
                  Ninguém cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="space-y-6">
        {Object.entries(porDia).map(([dia, itens]) => (
          <section key={dia} className="cartao p-5">
            <div className="flex items-center justify-between gap-2 border-b border-linha pb-2.5">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-musgo">
                {new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </h2>
              <span className="rounded-full border border-linha bg-casca px-2.5 py-0.5 font-mono text-xs text-tinta/70">
                {itens.length} {itens.length === 1 ? "registro" : "registros"}
              </span>
            </div>

            <ol className="mt-4 space-y-3 border-l-2 border-linha pl-4">
              {itens.map((r, i) => (
                <li key={i} className="relative py-0.5">
                  <span className="absolute -left-[21px] top-2 h-2.5 w-2.5 rounded-full bg-musgo ring-4 ring-papel" />
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <time className="rounded bg-casca px-1.5 py-0.5 font-mono text-xs text-tinta/70">
                      {new Date(r.em).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Sao_Paulo",
                      })}
                    </time>
                    <span className="text-sm font-bold text-tinta">
                      {r.autor ?? "—"}
                    </span>
                    <span className="text-sm text-tinta/70">
                      {VERBO[r.acao] ?? r.acao}
                    </span>
                    {r.valor_novo && r.acao !== "criou" && (
                      <span className="rounded-full border border-linha bg-campo px-2 py-0.5 font-mono text-xs font-semibold text-tinta">
                        {r.valor_novo}
                      </span>
                    )}
                    {r.tarefa && (
                      <span className="text-sm text-tinta">
                        em <strong className="font-semibold">{r.tarefa}</strong>
                      </span>
                    )}
                    {r.frente && (
                      <span className="rounded-full border border-musgo/40 bg-musgo/10 px-2 py-0.5 text-xs font-medium text-musgo">
                        {r.escopo === "frente" ? "frente" : "tema"} · {r.frente}
                        {r.frente_unidade &&
                          ` (${UNIDADES_FRENTE.find((u) => u.id === r.frente_unidade)?.nome ?? r.frente_unidade})`}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {porDiaGithub[dia]?.length > 0 && (
              <div className="mt-4 rounded-xl border border-linha bg-campo/60 p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-tinta">
                  <IconeGit className="h-3.5 w-3.5 text-musgo" />
                  Commits no GitHub neste dia
                </p>
                <ul className="mt-2 space-y-1">
                  {porDiaGithub[dia].map((c) => (
                    <li key={c.sha} className="text-xs text-tinta/70">
                      <span className="font-mono font-semibold text-tinta">
                        {c.author?.login ?? c.commit.author?.name ?? "—"}
                      </span>
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
