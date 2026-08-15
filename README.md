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
  page.tsx            painel da semana (atrasadas / 7 dias / fila)
  tarefas/            quadro kanban + criação de tarefas
  calendario/         grade mensal por prazo
  relatorio/          trilha de atividades + exportação CSV
  login/              entrada e cadastro
components/           cartão, selo, navegação, exportador
lib/                  clientes Supabase e tipos
supabase/schema.sql   tabelas, triggers, RLS e a view do relatório
```

## Como a trilha funciona

A tabela `historico` recebe uma linha a cada `INSERT`, `UPDATE` ou `DELETE` em
`tarefas`, via trigger no Postgres. Ninguém precisa lembrar de registrar nada, e
não existe policy de `UPDATE` ou `DELETE` nessa tabela — o registro não pode ser
reescrito depois. A página **Trilha** lê a view `relatorio_atividades` e exporta
tudo em CSV.

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

- [ ] Arrastar e soltar entre colunas do quadro
- [ ] Filtro por responsável no calendário
- [ ] Comentários por tarefa
- [ ] Exportar a trilha em PDF, além de CSV
- [ ] Notificação por e-mail quando um prazo estiver a 1 dia
