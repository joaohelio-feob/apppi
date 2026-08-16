# Contexto para o Claude Code

Projeto Integrador do 1º semestre de Ciência da Computação (UNIFEOB). Este repo
é o painel interno da equipe: quadro de tarefas, calendário de prazos, controle
de frentes/integrantes e trilha de atividades para a entrega final.

## Regras do projeto

- Código e interface **em português do Brasil**. Nomes de variáveis, funções,
  colunas do banco e textos de tela seguem o português — mantenha o padrão.
- Toda mudança em `tarefas` (e em `tarefa_responsaveis`) precisa continuar
  disparando os triggers de `historico`. Não crie caminhos que gravem direto
  no banco pulando essas tabelas.
- Nunca adicione policy de `UPDATE` ou `DELETE` em `historico`.
- Tarefas nunca são apagadas de verdade — só arquivadas (`arquivada = true`).
  Não existe policy de `DELETE` em `tarefas`.
- **Responsável não é mais coluna em `tarefas`.** É a tabela
  `tarefa_responsaveis` (`tarefa_id`, `membro_id`) — uma tarefa individual tem
  uma linha, uma tarefa de frente tem uma por integrante da frente. Use
  `responsaveisDe(tarefa)` (`lib/types.ts`) pra ler, nunca leia
  `tarefa.responsavel_id` (não existe).
- **Tarefa de frente atribui todo mundo da frente sozinha, via trigger no
  banco** (`atribuir_responsaveis_frente`, dispara ao criar ou quando o
  escopo vira `'frente'`). Não é retroativo: quem entra numa frente depois
  não ganha as tarefas antigas dela — o trigger só roda no INSERT/mudança de
  escopo, nunca por causa de alguém mudar de frente em `membros`. Não tente
  "corrigir" isso atribuindo manualmente tarefas antigas — é intencional.
- O banco garante em nível de constraint/trigger que tarefa `individual` tem
  no máximo 1 responsável e tarefa `frente` tem pelo menos 1
  (`verificar_responsaveis`). Se for mexer em `tarefa_responsaveis` na mão,
  respeite isso ou a escrita vai ser rejeitada.
- Chaves e segredos só em `.env.local` e nas Environment Variables da Vercel.
  `GITHUB_TOKEN` nunca em variável `NEXT_PUBLIC_` — só é lido nos Route
  Handlers de `app/api/github/*`, no servidor.
- A integração com o GitHub (`/codigo`, `app/api/github/*`) é **somente
  leitura, de propósito**: o painel nunca cria commit. Se criasse, tudo
  apareceria sob uma única conta e destruiria a evidência de trabalho
  colaborativo que o PI é avaliado.
- Tailwind: use os tokens do tema (`campo`, `casca`, `linha`, `tinta`, `musgo`,
  `broto`, `trigo`, `ferro`). Não invente cores soltas.
- **`frentes.unidade` é a única fonte de verdade da unidade de estudo — não
  existe mais `tarefas.unidade`.** A unidade de estudo do PI (POO,
  Modelagem, Lógica, BI, Autoconhecimento) é propriedade da frente; uma
  tarefa a alcança pelo `frente_id`, que agora é opcional em tarefa
  `individual` (tema/matéria da tarefa, sem afetar quem é responsável) e
  obrigatório em tarefa `frente`. Não recrie uma coluna de unidade em
  `tarefas` — se precisar filtrar/agrupar por unidade, sempre passe pelo
  `frente_id` embutido (`frentes(id, nome, cor, unidade)`).
- `frentes.cor` guarda o **nome de um token do tema** (`musgo` | `trigo` |
  `broto` | `ferro`), nunca hexadecimal. As classes completas ficam mapeadas
  em `CLASSES_COR_FRENTE` / `CLASSES_COR_FRENTE_PREENCHIDA` (`lib/types.ts`)
  — o Tailwind só gera CSS pra classe que aparece literal no código-fonte, então
  nunca monte `border-${cor}` nem derive uma classe de outra com `.replace()`
  em tempo de execução; sempre passe pelo mapa.
- Tipografia: `font-display` para títulos, `font-corpo` para texto, `font-mono`
  para datas, contadores e rótulos técnicos.
- Contraste: texto secundário nunca abaixo de `text-tinta/70` — é o piso que
  bate 4.5:1 (WCAG AA) tanto sobre `campo` quanto sobre `casca`; `/50` e `/60`
  ficam abaixo disso (medido: ~3.2:1 e ~4.2:1 sobre `campo`). Tamanho de texto
  nunca abaixo de `text-xs` (12px) — não use `text-[10px]`/`text-[11px]`.
- **Hierarquia visual no calendário: atraso > prioridade > status.** Os três
  sinais são camadas que se somam, nunca se substituem. Status é a base (cor
  de fundo do chip — já usa os 4 tokens do tema, um por status). Prioridade é
  forma (glifo ▲/●/▽, `CLASSES_PRIORIDADE` em `lib/types.ts`) mais borda
  esquerda — só `alta` ganha cor (`broto`, o único token que sobrou livre
  depois do status já ter tomado os outros 3), pra não ambiguar com status.
  Atraso soma um `ring-trigo` + `!` no início do texto por cima de tudo isso,
  **sem esconder o glifo de prioridade** — uma tarefa atrasada de prioridade
  baixa continua mostrando "▽" (baixa) e o anel de atraso ao mesmo tempo. É
  assim que os dois sinais não se anulam: nenhum precisa ceder lugar ao
  outro porque não competem pelo mesmo canal visual (forma vs. anel/glifo
  de texto).
- **Fluxo de entrega/revisão não criou status novo.** `tarefas.status`
  continua só `pendente | fazendo | revisao | concluida` — "pendente no
  git" é um **badge derivado**, calculado num lugar só: a view
  `tarefas_estado_entrega` (`pendente_git = precisa_commit and
  commit_confirmado_em is null`), nunca recalculado componente a
  componente. `entregas` e `revisoes` são histórico append-only (sem
  policy de `UPDATE`/`DELETE`, mesma regra de `historico`); cada
  reentrega e cada revisão é uma linha nova, nada é sobrescrito. Quem
  revisa é `tarefas.revisor_id` (opcional, 1 pessoa) — sem revisor, a
  entrega já conclui a tarefa direto. Revisor nunca pode estar em
  `tarefa_responsaveis` da mesma tarefa — vale na policy de `insert` em
  `revisoes`, não dá pra expressar como `check` em `tarefas` porque
  responsável é tabela à parte (pode ter N pessoas numa tarefa de
  frente).

## Comandos

```bash
npm run dev      # desenvolvimento
npm run build    # verifica se compila antes de abrir PR
```

## Onde mexer

- Regras de negócio de tarefa/frente/responsável → `lib/types.ts` e
  `supabase/schema.sql`
- Interface do quadro (duas visões: Individuais/Da frente) → `app/tarefas/page.tsx`
- Formulário de nova tarefa (pergunta o escopo primeiro) → `components/FormularioTarefa.tsx`
- Painel de detalhe/edição de uma tarefa (abre ao clicar num `CartaoTarefa`,
  em qualquer página) → `components/DetalheTarefa.tsx`. Reúne os campos que
  antes só davam pra editar espalhados entre `/atribuicoes` e `/entregas` —
  inclusive `inicio`, que não tinha UI nenhuma antes. Anexos (lista/upload/
  remoção) ficam em `components/GerenciadorAnexos.tsx`, reaproveitado por
  `DetalheTarefa` e por `/entregas`.
- Tabela de atribuições (edição campo a campo, tempo real) → `app/atribuicoes/page.tsx`
- Grade do calendário → `app/calendario/page.tsx`
- Painel de uma frente (tarefas conjuntas + individuais dos integrantes) → `app/frentes/[id]/page.tsx`
- Painel de um integrante (individual x frente, separado) → `app/equipe/[id]/page.tsx`
- Trilha (com resumo por pessoa) → `app/relatorio/page.tsx`
- Sprint Report → `app/sprint/page.tsx`
- Integração GitHub (somente leitura) → `lib/github.ts` + `app/api/github/*` + `app/codigo/page.tsx`
- Exportação CSV/PDF (reaproveitável) → `components/BotaoExportarCSV.tsx` + `components/BotaoExportarPDF.tsx`

## Variáveis de ambiente

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — obrigatórias.
- `GITHUB_TOKEN`, `GITHUB_ORG`, `GITHUB_REPO` — opcionais, só pra página `/codigo`.
  Sem elas o site funciona normal, só essa página mostra um aviso.
