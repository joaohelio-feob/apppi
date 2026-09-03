const FUSO = "America/Sao_Paulo";

/** Data local (America/Sao_Paulo) no formato YYYY-MM-DD, para comparar com colunas `date`. */
export function dataLocalISO(data: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);
  const pegar = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${pegar("year")}-${pegar("month")}-${pegar("day")}`;
}

/** Mesma coisa, a partir de um timestamp (ex.: coluna timestamptz vinda do banco). */
export function dataLocalDeTimestamp(timestamp: string): string {
  return dataLocalISO(new Date(timestamp));
}

function paraDiaUTC(iso: string): number {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia);
}

/** Diferença em dias entre duas datas YYYY-MM-DD (positivo = isoAlvo é depois de isoBase). */
export function diasEntre(isoAlvo: string, isoBase: string): number {
  return Math.round((paraDiaUTC(isoAlvo) - paraDiaUTC(isoBase)) / 86_400_000);
}

/**
 * "Está atrasada?" — fonte única do cálculo, porque ele depende do relógio e
 * o quadro e o calendário não podem discordar. Passe sempre o mesmo `hoje`
 * (dataLocalISO()) que a tela já usa pra marcar o dia corrente, senão duas
 * partes da mesma página podem cair em lados diferentes da virada do dia.
 * Tarefa concluída nunca está atrasada, mesmo com prazo vencido.
 */
export function estaAtrasada(
  status: string,
  prazo: string | null,
  hoje: string = dataLocalISO()
): boolean {
  return status !== "concluida" && !!prazo && prazo < hoje;
}
