/** Tipos de lib/contrato-tarefa.mjs — ver o cabeçalho de lá sobre por que é .mjs. */

export type Frente = { id: number; nome: string; unidade?: string | null };
export type Membro = { id: string; nome: string; frente_id?: number | null };

/** Devolve a lista de erros; vazia quer dizer aprovado. Não toca no banco. */
export function validar(
  tarefa: unknown,
  indice: number,
  contexto: { frentes: Frente[]; membros: Membro[] }
): string[];
