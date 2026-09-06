/** Tipos de lib/nomes.mjs — ver o comentário de cabeçalho de lá sobre por que é .mjs. */

export type Resolucao<T> =
  | { ok: true; item: T }
  | { ok: false; motivo: "nao-encontrado"; disponiveis: string[] }
  | { ok: false; motivo: "ambiguo"; candidatos: string[] };

export function normalizarNome(valor: string): string;

export function resolverPorNome<T>(
  procurado: string,
  lista: T[],
  nomeDe: (item: T) => string
): Resolucao<T>;

export function explicarResolucao(
  campo: string,
  procurado: string,
  r: Resolucao<unknown>
): string;
