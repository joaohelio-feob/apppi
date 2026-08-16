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
- Tipografia: `font-display` para títulos, `font-corpo` para texto, `font-mono`
  para datas, contadores e rótulos técnicos.

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
