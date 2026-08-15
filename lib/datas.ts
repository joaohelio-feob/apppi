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
