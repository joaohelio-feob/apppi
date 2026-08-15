# Contexto para o Claude Code

Projeto Integrador do 1º semestre de Ciência da Computação (UNIFEOB). Este repo
é o painel interno da equipe: quadro de tarefas, calendário de prazos e trilha de
atividades para a entrega final.

## Regras do projeto

- Código e interface **em português do Brasil**. Nomes de variáveis, funções,
  colunas do banco e textos de tela seguem o português — mantenha o padrão.
- Toda mudança em `tarefas` precisa continuar disparando os triggers de
  `historico`. Não crie caminhos que gravem direto no banco pulando a tabela.
- Nunca adicione policy de `UPDATE` ou `DELETE` em `historico`.
- Chaves e segredos só em `.env.local` e nas Environment Variables da Vercel.
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

- Regras de negócio de tarefa → `lib/types.ts` e `supabase/schema.sql`
- Interface do quadro → `app/tarefas/page.tsx`
- Grade do calendário → `app/calendario/page.tsx`
- Relatório e exportação → `app/relatorio/page.tsx` + `components/BotaoExportar.tsx`
