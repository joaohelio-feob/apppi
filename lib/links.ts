/**
 * `tarefas.local_entrega` é `text` livre: guarda o link onde a atividade foi
 * ou será entregue (Drive, Forms, PR do GitHub...), mas quem preenche é a
 * equipe, na mão — então também guarda, uma hora ou outra, prosa, um caminho
 * de arquivo, ou um link colado pela metade.
 *
 * Este módulo decide, num lugar só, o que vira `href` e o que vira texto.
 */

export type LocalEntrega =
  /** URL http(s) legítima: pode virar link. */
  | { tipo: "link"; href: string; rotulo: string; titulo: string }
  /** Qualquer outra coisa: mostra como texto, nunca como link. */
  | { tipo: "texto"; rotulo: string; titulo: string };

/**
 * Encurta a URL pro chip do cartão sem perder de onde ela é: mantém o host
 * (sem "www.") e os dois últimos segmentos do caminho, que é onde mora a
 * parte identificável — `github.com/…/pull/42` em vez dos 60 caracteres
 * inteiros. O valor completo vai no `title`, sempre.
 */
function encurtar(url: URL): string {
  const host = url.hostname.replace(/^www\./, "");
  const partes = url.pathname.split("/").filter(Boolean);
  if (partes.length === 0) return host;
  if (partes.length <= 2) return `${host}/${partes.join("/")}`;
  return `${host}/…/${partes.slice(-2).join("/")}`;
}

export function lerLocalEntrega(valor: string | null | undefined): LocalEntrega | null {
  const bruto = valor?.trim();
  if (!bruto) return null;

  try {
    const url = new URL(bruto);
    // O guarda que importa: `new URL` aceita felizmente `javascript:alert(1)`
    // e `data:text/html,...`. Só http e https viram href — o resto cai como
    // texto, visível e inofensivo, em vez de virar um link executável.
    if (url.protocol === "http:" || url.protocol === "https:") {
      return { tipo: "link", href: url.href, rotulo: encurtar(url), titulo: bruto };
    }
  } catch {
    // Não é URL absoluta ("drive.google.com/algo", "entregar no Classroom",
    // um caminho de arquivo). Segue como texto.
  }

  return { tipo: "texto", rotulo: bruto, titulo: bruto };
}
