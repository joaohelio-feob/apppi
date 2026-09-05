/**
 * Critérios de aceite (DoD) escritos dentro de `tarefas.descricao`, na
 * convenção markdown `- [ ]` / `- [x]`.
 *
 * A descrição continua sendo texto livre: isto aqui é opt-in. Quem não usa
 * checkbox nenhuma escreve prosa normal e não vê checklist em lugar nenhum
 * (nem barra de progresso no cartão) — nada de seção vazia órfã.
 *
 * Regra inegociável: marcar/desmarcar um item troca UM caractere — o miolo
 * do `[ ]` — e devolve todo o resto do texto byte a byte igual. Mesma
 * indentação, mesmo marcador de lista (`-`, `*`, `+`), mesmo espaçamento,
 * mesmo final de linha (\r\n inclusive), mesmas linhas que não são
 * critério. O markdown de quem escreveu não é reescrito nem normalizado.
 *
 * Única perda conhecida, e é de um caractere só: quem escreveu `- [X]` em
 * maiúsculo e desmarcar o item vira `- [ ]`; remarcar depois escreve `- [x]`
 * minúsculo, porque a caixa vazia não guarda de que letra ela veio. Os dois
 * são o mesmo markdown e renderizam igual. Nenhuma outra linha é tocada.
 */

export type CriterioAceite = {
  /** Índice da linha dentro da descrição — é a identidade do item. */
  linha: number;
  /** O texto do critério, sem o `- [ ] ` da frente. */
  texto: string;
  feito: boolean;
};

/**
 * Uma linha de critério, fatiada em 4 pedaços que, concatenados, reproduzem
 * a linha original: prefixo + marcador + fecho + texto. Só o marcador muda.
 *
 * O texto é `[\s\S]*`, não `.*`, de propósito: em JavaScript `.` não casa
 * `\r`, que é terminador de linha. Com `.*` a regex devolvia null em texto
 * salvo com CRLF (um <textarea> pode mandar \r\n), e a checklist inteira
 * sumia. Aqui a busca já roda linha a linha, então `[\s\S]` não atravessa
 * nada — só deixa o \r final entrar no grupo e voltar intacto na remontagem.
 */
const LINHA_CRITERIO = /^(\s*[-*+]\s+\[)([ xX])(\][^\S\r\n]?)([\s\S]*)$/;

export function lerCriterios(descricao: string | null | undefined): CriterioAceite[] {
  if (!descricao) return [];
  const criterios: CriterioAceite[] = [];
  descricao.split("\n").forEach((linha, i) => {
    const partes = LINHA_CRITERIO.exec(linha);
    if (!partes) return;
    criterios.push({
      linha: i,
      texto: partes[4].trimEnd(),
      feito: partes[2] !== " ",
    });
  });
  return criterios;
}

/**
 * Devolve a descrição com um único critério marcado/desmarcado. Se a linha
 * não existir mais ou não for mais um critério (alguém editou o texto no
 * meio do caminho), devolve a descrição intacta em vez de corromper.
 */
export function alternarCriterio(descricao: string, linha: number, feito: boolean): string {
  const linhas = descricao.split("\n");
  const alvo = linhas[linha];
  if (alvo === undefined) return descricao;

  const partes = LINHA_CRITERIO.exec(alvo);
  if (!partes) return descricao;

  linhas[linha] = `${partes[1]}${feito ? "x" : " "}${partes[3]}${partes[4]}`;
  return linhas.join("\n");
}

/**
 * Resumo pro cartão do quadro. `null` quando não há critério nenhum — o
 * chamador usa isso pra não abrir espaço no layout.
 */
export function progressoCriterios(
  descricao: string | null | undefined
): { feitos: number; total: number } | null {
  const criterios = lerCriterios(descricao);
  if (criterios.length === 0) return null;
  return { feitos: criterios.filter((c) => c.feito).length, total: criterios.length };
}

/** As linhas da descrição que NÃO são critério — o texto corrido de quem escreveu. */
export function textoSemCriterios(descricao: string | null | undefined): string {
  if (!descricao) return "";
  return descricao
    .split("\n")
    .filter((linha) => !LINHA_CRITERIO.test(linha))
    .join("\n")
    .trim();
}
