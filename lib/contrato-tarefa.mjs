/**
 * Validação do objeto de handoff de docs/CONTRATO-TAREFA.md, num lugar só.
 *
 * Compartilhada entre scripts/publicar-tarefas.mjs (Cursor) e a página
 * /publicar: as duas precisam recusar exatamente as mesmas coisas, senão o
 * contrato passa a ter duas interpretações.
 *
 * É .mjs, não .ts, pelo mesmo motivo de lib/nomes.mjs: o script roda em Node
 * puro e um .ts exigiria type stripping, que não existe no Node 20 fixado em
 * .github/workflows/ci.yml. Os tipos vivem em contrato-tarefa.d.mts.
 */

import { resolverPorNome, explicarResolucao } from "./nomes.mjs";

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
