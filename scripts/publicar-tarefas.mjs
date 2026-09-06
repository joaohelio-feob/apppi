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
import { resolverPorNome, explicarResolucao } from "../lib/nomes.mjs";

const CHAVES_PERMITIDAS = new Set([
  "titulo", "descricao", "escopo", "frente", "responsavel", "revisor",
  "prioridade", "prazo", "local_entrega", "issue_numero", "observacoes",
]);

const ESCOPOS = new Set(["individual", "frente"]);
const PRIORIDADES = new Set(["baixa", "media", "alta"]);

/** Rótulo que vazou para dentro do valor — o defeito que sujou as tarefas atuais. */
const ROTULOS_VAZADOS = /^\s*(t[ií]tulo|descri[cç][aã]o|prazo|respons[aá]vel|revisor|prioridade|frente|escopo|observa[cç][oõ]es)\s*:/i;

function ehDataISO(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Valida um objeto contra a seção E do contrato. Devolve a lista de erros —
 * vazia quer dizer aprovado. Não toca no banco.
 */
export function validar(t, i, { frentes, membros }) {
  const e = [];
  const onde = `tarefa #${i + 1}`;
  const err = (m) => e.push(`${onde}: ${m}`);

  if (typeof t !== "object" || t === null || Array.isArray(t)) {
    return [`${onde}: não é um objeto.`];
  }

  // 4 — nenhuma chave fora do contrato
  for (const k of Object.keys(t)) {
    if (!CHAVES_PERMITIDAS.has(k)) {
      const dica =
        k === "unidade" ? " Unidade vem de frentes.unidade, não da tarefa (contrato A.8)."
        : k === "status" ? " Toda tarefa nasce pendente (contrato B.2)."
        : k === "criador_id" ? " Criador vem da sessão de quem publica (contrato B.1)."
        : k === "esforco" || k === "depende_de" ? " Não existe coluna para isso (contrato C)."
        : "";
      err(`chave desconhecida "${k}".${dica}`);
    }
  }

  // 1 — título
  if (typeof t.titulo !== "string" || !t.titulo.trim()) err("titulo é obrigatório e não pode ser vazio.");

  // 2 — rótulo dentro do valor
  for (const campo of ["titulo", "descricao", "observacoes"]) {
    if (typeof t[campo] === "string" && ROTULOS_VAZADOS.test(t[campo])) {
      err(`${campo} começa com um rótulo ("${t[campo].slice(0, 24)}…"). Rótulo é chave, não texto dentro do valor.`);
    }
  }

  // 3 — título truncado no começo
  if (typeof t.titulo === "string" && /^[a-zàáâãéêíóôõúç]/.test(t.titulo)) {
    err(`titulo começa em minúscula ("${t.titulo.slice(0, 20)}…") — confira se não faltou a primeira letra.`);
  }

  // 7 — escopo
  if (!ESCOPOS.has(t.escopo)) err(`escopo deve ser "individual" ou "frente", veio ${JSON.stringify(t.escopo)}.`);

  // 8 — prioridade (o banco aceitaria lixo: não há check nessa coluna)
  if (t.prioridade !== undefined && t.prioridade !== null && !PRIORIDADES.has(t.prioridade)) {
    err(`prioridade deve ser baixa, media ou alta, veio ${JSON.stringify(t.prioridade)}.`);
  }

  // 9/10 — escopo x frente x responsável
  if (t.escopo === "frente") {
    if (!t.frente) err("tarefa de frente precisa de frente.");
    if (t.responsavel) {
      err('tarefa de frente não leva "responsavel": o trigger atribui todos os integrantes da frente (contrato A.4).');
    }
  }

  // 11 — nomes resolvem para exatamente um registro
  const achados = {};
  for (const [campo, lista, nomeDe] of [
    ["frente", frentes, (f) => f.nome],
    ["responsavel", membros, (m) => m.nome],
    ["revisor", membros, (m) => m.nome],
  ]) {
    const valor = t[campo];
    if (!valor) continue;
    if (typeof valor !== "string") { err(`${campo} deve ser o nome em texto.`); continue; }
    const r = resolverPorNome(valor, lista, nomeDe);
    if (r.ok) achados[campo] = r.item;
    else err(explicarResolucao(campo, valor, r));
  }

  // 12 — revisor ≠ responsável (o banco só barra na hora de revisar)
  if (achados.responsavel && achados.revisor && achados.responsavel.id === achados.revisor.id) {
    err("revisor é a mesma pessoa do responsável. O banco só barra isso na policy de insert em revisoes — semanas depois, ao revisar (contrato A.5).");
  }

  // 13 — revisor não pode estar na frente de uma tarefa de frente
  if (t.escopo === "frente" && achados.frente && achados.revisor) {
    if (achados.revisor.frente_id === achados.frente.id) {
      err(`revisor "${achados.revisor.nome}" é integrante da frente "${achados.frente.nome}" e será atribuído como responsável pelo trigger — ninguém revisa a própria tarefa (contrato A.5).`);
    }
  }

  // 14 — prazo
  if (t.prazo !== undefined && t.prazo !== null && !ehDataISO(t.prazo)) {
    err(`prazo deve ser "AAAA-MM-DD", veio ${JSON.stringify(t.prazo)}.`);
  }

  // 15 — local de entrega que pretende ser link
  if (typeof t.local_entrega === "string" && t.local_entrega.trim()) {
    const v = t.local_entrega.trim();
    const pareceLink = /^[\w.-]+\.(com|br|org|net|io|dev)(\/|$)/i.test(v) || /^\w+:\/\//.test(v);
    const ehHttp = /^https?:\/\//i.test(v);
    if (pareceLink && !ehHttp) {
      err(`local_entrega "${v.slice(0, 40)}" parece um link mas não começa com http(s) — vai virar anotação em texto, sem link clicável (contrato A.6).`);
    }
  }

  // 16 — revisor escondido em observacoes
  if (typeof t.observacoes === "string" && /revisor\s*[:=]/i.test(t.observacoes)) {
    err('observacoes menciona "revisor:". Revisor é a coluna revisor_id, não texto livre (contrato A.5).');
  }

  // 17 — issue
  if (t.issue_numero !== undefined && t.issue_numero !== null) {
    if (!Number.isInteger(t.issue_numero) || t.issue_numero < 1) {
      err(`issue_numero deve ser inteiro >= 1, veio ${JSON.stringify(t.issue_numero)}.`);
    }
  }

  return e;
}

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

// Só roda quando executado direto; importar o módulo (para testar `validar`)
// não dispara publicação nenhuma.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
