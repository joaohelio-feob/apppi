# Caderno de Campo · Painel do PI

Painel de tarefas da equipe do Projeto Integrador. Quadro kanban, calendário de
prazos e uma trilha de atividades gravada automaticamente pelo banco — que serve
de evidência de divisão de trabalho na entrega final.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Supabase** — Postgres, autenticação e realtime
- **Tailwind CSS**
- Deploy na **Vercel**

## Rodando pela primeira vez

### 1. Dependências

```bash
npm install
```

### 2. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (plano free)
2. Abra **SQL Editor** e cole o conteúdo de `supabase/schema.sql`. Rode.
3. Em **Database → Replication**, ative a publicação `supabase_realtime` para a
   tabela `tarefas` (é o que faz o quadro atualizar sozinho)
4. Em **Authentication → Providers → Email**, desmarque *Confirm email* enquanto
   estiverem desenvolvendo

### 3. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha com a URL e a chave `anon` que estão em **Project Settings → API**.

`GITHUB_TOKEN`, `GITHUB_ORG` e `GITHUB_REPO` são opcionais — só alimentam a
página **Código** (commits, Pull Requests, status do CI). Sem eles, essa
página mostra um aviso e o resto do site funciona normal. Veja como gerar o
token em [Integração com o GitHub](#integração-com-o-github-somente-leitura).

### 4. Subir

```bash
npm run dev
```

Abra http://localhost:3000, crie sua conta e comece pelo quadro.

## Deploy na Vercel

1. `vercel.com` → **Add New → Project** → importe o repositório da organização
2. Em **Environment Variables**, cadastre `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy

Cada push na `main` republica o site. Cada Pull Request ganha uma URL de preview
própria, então dá para testar antes de mergear.

## Estrutura

```
app/
  page.tsx             painel da semana (atrasadas / 7 dias / fila)
  tarefas/              quadro kanban — visões "Individuais" e "Da frente"
  atribuicoes/          tabela editável de tarefa, responsável, dia, frente,
                        prioridade e status, em tempo real — "Nova atribuição"
                        abre o mesmo formulário completo do Quadro
  calendario/           grade mensal por prazo, com filtro por responsável
  equipe/                 lista de integrantes (papel, frente)
  equipe/[id]/             painel de um integrante — individual x frente, separado
  frentes/                 lista de frentes + criar frente nova
  frentes/[id]/            painel da frente — tarefas conjuntas + trabalho individual
  entregas/                relatório enxuto (tarefa, quem fez, data, subiu no git)
  codigo/                  commits, Pull Requests e CI do GitHub (somente leitura)
  relatorio/               trilha de atividades + resumo por pessoa + exportação
  reunioes/                ata das reuniões da equipe
  sprint/                  Sprint Report por intervalo de datas
  login/                   entrada e cadastro
  api/github/              Route Handlers que falam com a API do GitHub (servidor)
components/              cartão (abre o painel de detalhe ao clicar), formulário
                        de tarefa, painel de detalhe/edição, gerenciador de
                        anexos, navegação, exportadores...
lib/                     clientes Supabase, tipos, datas, acesso ao GitHub
supabase/schema.sql      tabelas, triggers, RLS, view do relatório e migrações
```

## Como a trilha funciona

A tabela `historico` recebe uma linha a cada `INSERT`/`UPDATE` em `tarefas` e a
cada `INSERT`/`UPDATE`/`DELETE` em `tarefa_responsaveis`, via trigger no
Postgres. Ninguém precisa lembrar de registrar nada, e não existe policy de
`UPDATE` ou `DELETE` em `historico` — o registro não pode ser reescrito depois.
A página **Trilha** lê a view `relatorio_atividades` (que já cruza histórico,
tarefa, escopo e frente — com a unidade de estudo da frente), mostra um resumo
por pessoa e exporta tudo em CSV ou PDF.

## Frentes e tarefas individuais

Toda tarefa tem um **escopo**: `individual` (uma pessoa só) ou `frente`
(pertence à frente inteira). Quem executa fica em `tarefa_responsaveis` — uma
linha por pessoa, então uma tarefa de frente com 3 integrantes tem 3 linhas e
aparece no painel dos 3.

- **Tarefa de frente**: ao criar (ou quando o escopo muda pra `frente`), um
  trigger no banco atribui automaticamente todo mundo que já está naquela
  frente (`membros.frente_id`). Não é retroativo — quem entra na frente
  depois não ganha as tarefas antigas dela.
- **Tarefa individual**: escolhe uma pessoa só no formulário. Pode opcionalmente
  marcar uma frente (`tarefas.frente_id`), como tema/matéria da tarefa — não
  muda quem é responsável, só de onde vem a unidade de estudo mostrada nos
  relatórios.
- A unidade de estudo do PI (POO, Modelagem, Lógica, BI, Autoconhecimento) é
  propriedade da frente (`frentes.unidade`), não da tarefa. Uma tarefa a
  alcança pelo `frente_id`, tenha ela escopo `frente` ou `individual`.
- Cada integrante pertence a uma frente só (`/equipe`, seletor "sua frente").
  Frentes de uma pessoa só funcionam igual às outras — não tem caso especial.
- O banco garante (`verificar_responsaveis`) que tarefa `individual` tem no
  máximo 1 responsável e `frente` tem pelo menos 1, não importa por qual
  caminho a escrita veio.

## Integração com o GitHub (somente leitura)

A página **Código** (`/codigo`) espelha commits, Pull Requests e status do CI
do repositório da equipe. É **decisão de projeto** que essa integração seja só
leitura: o painel nunca cria commit. Se ele commitasse por conta própria, tudo
apareceria sob uma única conta de serviço — e o PI é avaliado pelo histórico
de commits como evidência de trabalho colaborativo. Isso destruiria justamente
a prova que a Trilha existe pra preservar. Cada integrante continua commitando
da própria máquina, com a própria conta.

Como configurar:

1. Em `github.com/settings/tokens` (ou nas configurações da organização), crie
   um **fine-grained token** só de leitura (`Contents`, `Pull requests`,
   `Issues`, `Checks`) restrito ao repositório da equipe.
2. Defina `GITHUB_TOKEN`, `GITHUB_ORG` e `GITHUB_REPO` em `.env.local` (local)
   e nas **Environment Variables** da Vercel (produção) — nunca em variável
   `NEXT_PUBLIC_`, porque essas vão para o navegador. O token só é lido pelos
   Route Handlers em `app/api/github/*`, que rodam no servidor.
3. Sem essas variáveis, `/codigo` mostra um aviso em vez de quebrar, e o
   `npm run build` (inclusive no CI) passa normalmente — a integração é
   totalmente opcional.

As respostas ficam em cache por 5 minutos (`revalidate`) pra não estourar o
limite de requisições da API do GitHub.

## Convenção de commits

Use o padrão Conventional Commits e cite a issue:

```
feat: cadastro de funcionário (closes #12)
fix: corrige cálculo de dias até o prazo
docs: atualiza README com passos do Supabase
chore: sobe dependências
```

O histórico do banco mostra a execução, o histórico do Git mostra o código. Na
entrega, os dois juntos contam o semestre inteiro.

## Fluxo de trabalho da equipe

```bash
git checkout main && git pull
git checkout -b feat/nome-curto
# trabalha, commita
git push -u origin feat/nome-curto
# abre o Pull Request no GitHub, alguém revisa, merge
```

Configure em **Settings → Rules** do repositório: exigir 1 aprovação antes do
merge na `main`.

## Próximos passos sugeridos

- [ ] Comentários por tarefa
- [ ] Notificação por e-mail quando um prazo estiver a 1 dia
- [ ] Editar/renomear frente e mover integrante de frente com aviso do que muda
- [ ] Cruzar `issue_numero` com o vínculo tarefa ↔ frente na página **Código**
