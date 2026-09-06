#!/usr/bin/env node
/**
 * Publica tarefas a partir do objeto de handoff de docs/CONTRATO-TAREFA.md.
 *
 *   node scripts/publicar-tarefas.mjs tarefas.json --dry-run
 *   node scripts/publicar-tarefas.mjs tarefas.json
 *
 * Lê um objeto ou um array de objetos. Valida TUDO antes de tocar no banco e
 * recusa o lote inteiro se qualquer um falhar — não existe policy de DELETE
 * em tarefas, então não há rollback: tarefa criada por engano só pode ser
 * arquivada, e a linha dela na Trilha fica para sempre.
 *
 * Variáveis de ambiente:
 *   NEXT_PUBLIC_SUPABASE_URL       obrigatória
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  obrigatória
 *   PI_EMAIL / PI_SENHA            credenciais do membro que publica
 *
 * Nada de service_role, de propósito. A chave anon sozinha não passa no RLS
 * (as policies de escrita são `to authenticated`), e service_role contornaria
 * as policies sem sessão — com auth.uid() nulo, toda tarefa entraria na
 * Trilha como trabalho de ninguém, destruindo a evidência de divisão de
 * trabalho que o PI é avaliado.
 *
 * REQUISITO DE NODE: nenhum além do que o projeto já usa. lib/nomes.mjs é
 * ESM puro justamente para isto — um lib/nomes.ts exigiria type stripping,
 * que não existe no Node 20 fixado em .github/workflows/ci.yml. A regra de
 * comparação de nomes continua num lugar só, compartilhada com a página
 * /publicar, sem passo de build e sem piso de versão.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { resolverPorNome } from "../lib/nomes.mjs";
import { validar } from "../lib/contrato-tarefa.mjs";

async function main() {
  const args = process.argv.slice(2);
  const seco = args.includes("--dry-run");
  const arquivo = args.find((a) => !a.startsWith("--"));

  if (!arquivo) {
    console.error("uso: node scripts/publicar-tarefas.mjs <arquivo.json> [--dry-run]");
    process.exit(2);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.PI_EMAIL;
  const senha = process.env.PI_SENHA;

  for (const [nome, valor] of [
    ["NEXT_PUBLIC_SUPABASE_URL", url], ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anon],
    ["PI_EMAIL", email], ["PI_SENHA", senha],
  ]) {
    if (!valor) { console.error(`falta a variável ${nome}.`); process.exit(2); }
  }

  let bruto;
  try {
    bruto = JSON.parse(readFileSync(arquivo, "utf8"));
  } catch (erro) {
    console.error(`não deu pra ler ${arquivo}: ${erro.message}`);
    process.exit(2);
  }
  const tarefas = Array.isArray(bruto) ? bruto : [bruto];
  if (tarefas.length === 0) { console.error("nada para publicar."); process.exit(2); }

  const supabase = createClient(url, anon);

  // A sessão precisa existir mesmo no --dry-run: as listas de frentes e
  // membros estão atrás de RLS `to authenticated`, e sem elas não dá para
  // validar nome nenhum.
  const { error: erroLogin } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (erroLogin) { console.error(`login falhou: ${erroLogin.message}`); process.exit(1); }

  const { data: sessao } = await supabase.auth.getUser();
  const meuId = sessao.user?.id;
  if (!meuId) { console.error("sessão sem usuário — abortando."); process.exit(1); }

  const [{ data: frentes, error: ef }, { data: membros, error: em }] = await Promise.all([
    supabase.from("frentes").select("id, nome, unidade"),
    supabase.from("membros").select("id, nome, frente_id"),
  ]);
  if (ef || em) { console.error(`não deu pra ler frentes/membros: ${(ef ?? em).message}`); process.exit(1); }

  // ---- validação do lote inteiro, antes de qualquer escrita ----
  const erros = tarefas.flatMap((t, i) => validar(t, i, { frentes: frentes ?? [], membros: membros ?? [] }));

  if (erros.length > 0) {
    console.error(`\n${erros.length} problema(s). Nenhuma tarefa foi criada.\n`);
    erros.forEach((e) => console.error(`  ✗ ${e}`));
    console.error("\nO lote inteiro foi recusado de propósito: não existe policy de DELETE");
    console.error("em tarefas, então tarefa criada por engano não tem como ser desfeita.\n");
    process.exit(1);
  }

  // ---- o que seria feito ----
  console.log(`\n${tarefas.length} tarefa(s) aprovada(s) na validação. Publicando como ${email}.\n`);
  for (const [i, t] of tarefas.entries()) {
    const frente = t.frente ? resolverPorNome(t.frente, frentes, (f) => f.nome) : null;
    const resp = t.responsavel ? resolverPorNome(t.responsavel, membros, (m) => m.nome) : null;
    const rev = t.revisor ? resolverPorNome(t.revisor, membros, (m) => m.nome) : null;
    console.log(`  ${i + 1}. ${t.titulo}`);
    console.log(`     escopo ${t.escopo}${frente?.ok ? ` · frente ${frente.item.nome}` : ""}` +
      `${resp?.ok ? ` · responsável ${resp.item.nome}` : t.escopo === "frente" ? " · responsáveis: a frente toda (trigger)" : " · sem dono"}` +
      `${rev?.ok ? ` · revisor ${rev.item.nome}` : ""}` +
      `${t.prazo ? ` · prazo ${t.prazo}` : ""} · status pendente`);
  }

  if (seco) {
    console.log("\n--dry-run: nada foi escrito no banco.\n");
    process.exit(0);
  }

  // ---- publicação ----
  let criadas = 0;
  for (const [i, t] of tarefas.entries()) {
    const frente = t.frente ? resolverPorNome(t.frente, frentes, (f) => f.nome) : null;
    const rev = t.revisor ? resolverPorNome(t.revisor, membros, (m) => m.nome) : null;

    const { data: criada, error } = await supabase
      .from("tarefas")
      .insert({
        titulo: t.titulo.trim(),
        descricao: t.descricao?.trim() || null,
        // criador_id vem da sessão, nunca do objeto: autoria reivindicável
        // por texto colado quebraria a Trilha (contrato B.1).
        criador_id: meuId,
        escopo: t.escopo,
        frente_id: frente?.ok ? frente.item.id : null,
        revisor_id: rev?.ok ? rev.item.id : null,
        prioridade: t.prioridade ?? "media",
        prazo: t.prazo ?? null,
        local_entrega: t.local_entrega?.trim() || null,
        issue_numero: t.issue_numero ?? null,
        observacoes: t.observacoes?.trim() || null,
        // status omitido de propósito: o default é 'pendente' e o contrato
        // proíbe nascer em outro estado (contrato B.2).
      })
      .select("id")
      .single();

    if (error || !criada) {
      console.error(`\n  ✗ tarefa #${i + 1} ("${t.titulo}") falhou: ${error?.message}`);
      console.error(`\n  ${criadas} tarefa(s) já foram criadas e NÃO podem ser desfeitas`);
      console.error("  (sem policy de DELETE em tarefas). Arquive-as pelo painel se for o caso.");
      console.error(`  As ${tarefas.length - i - 1} restantes não foram tentadas.\n`);
      process.exit(1);
    }

    // Só individual: em tarefa de frente o trigger já atribuiu todo mundo
    // dentro da transação do INSERT acima (contrato A.4).
    if (t.escopo === "individual" && t.responsavel) {
      const resp = resolverPorNome(t.responsavel, membros, (m) => m.nome);
      const { error: erroResp } = await supabase
        .from("tarefa_responsaveis")
        .insert({ tarefa_id: criada.id, membro_id: resp.item.id });

      if (erroResp) {
        console.error(`\n  ⚠ tarefa #${i + 1} criada (id ${criada.id}) mas SEM responsável: ${erroResp.message}`);
        console.error("    A tarefa existe e não dá pra apagar. Atribua pelo painel de detalhes.\n");
      }
    }

    criadas++;
    console.log(`  ✓ #${i + 1} criada (id ${criada.id})`);
  }

  console.log(`\n${criadas} tarefa(s) publicadas.\n`);
}

// Só roda quando executado direto; importar o módulo não dispara publicação.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
