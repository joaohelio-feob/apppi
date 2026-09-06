/**
 * Resolução de nome → registro, num lugar só.
 *
 * É ESM puro (.mjs), não TypeScript, de propósito: este módulo é o único
 * compartilhado entre a página /publicar e scripts/publicar-tarefas.mjs, e
 * um .ts exigiria type stripping do Node — que não existe no Node 20 que o
 * CI do repo fixa (.github/workflows/ci.yml). Os tipos vivem em nomes.d.mts,
 * então quem consome pelo TypeScript continua tipado.
 *
 * O objeto de handoff do contrato (docs/CONTRATO-TAREFA.md) carrega NOMES —
 * "Lógica de Programação", "João Hélio" — porque é escrito e lido por gente,
 * colado à mão e gerado fora do banco. Quem traduz para `bigint`/`uuid` é
 * quem publica: a página /publicar e o script de publicação, os dois usando
 * estas funções.
 *
 * Duas regras que o contrato impõe e que estão implementadas aqui:
 *   - nome que não resolve é ERRO, com a lista do que existe — nunca criação
 *     implícita de frente ou de membro;
 *   - nome ambíguo é ERRO com os candidatos — nunca "o primeiro que casar".
 */

/**
 * Forma canônica para comparar nomes: sem acento, sem diferença de caixa,
 * espaços internos colapsados e bordas aparadas.
 *
 * "  LÓGICA  de   Programação " e "logica de programacao" são o mesmo nome.
 * Existe só aqui — comparação de nome espalhada pelo código é como duas
 * telas passam a discordar sobre quem é quem.
 */
export function normalizarNome(valor) {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Acha um item pelo nome. Primeiro tenta igualdade exata (normalizada); se
 * nada bater, aceita prefixo — é o que faz "João" achar "João Hélio". Em
 * qualquer um dos dois passos, mais de um candidato é ambiguidade e para.
 */
export function resolverPorNome(procurado, lista, nomeDe) {
  const alvo = normalizarNome(procurado);

  const exatos = lista.filter((item) => normalizarNome(nomeDe(item)) === alvo);
  if (exatos.length === 1) return { ok: true, item: exatos[0] };
  if (exatos.length > 1) {
    return { ok: false, motivo: "ambiguo", candidatos: exatos.map(nomeDe) };
  }

  // "João" achando "João Hélio" — mas só se for o único que começa assim.
  const porPrefixo = lista.filter((item) =>
    normalizarNome(nomeDe(item)).startsWith(alvo + " ")
  );
  if (porPrefixo.length === 1) return { ok: true, item: porPrefixo[0] };
  if (porPrefixo.length > 1) {
    return { ok: false, motivo: "ambiguo", candidatos: porPrefixo.map(nomeDe) };
  }

  return { ok: false, motivo: "nao-encontrado", disponiveis: lista.map(nomeDe) };
}

/** Mensagem pronta para a tela e para o terminal, no mesmo texto. */
export function explicarResolucao(campo, procurado, r) {
  if (r.ok) return "";
  if (r.motivo === "ambiguo") {
    return `${campo}: "${procurado}" é ambíguo — casa com ${r.candidatos.join(", ")}. Escreva o nome completo.`;
  }
  return `${campo}: "${procurado}" não existe. Disponíveis: ${r.disponiveis.join(", ") || "(nenhum)"}.`;
}
