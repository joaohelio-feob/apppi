import { INFO_STATUS, STATUS, type Status } from "@/lib/types";

export default function Selo({ status }: { status: Status }) {
  const s = STATUS.find((x) => x.id === status) ?? STATUS[0];
  const info = INFO_STATUS[status] ?? INFO_STATUS.pendente;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide ${s.cor}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          status === "concluida" || status === "revisao"
            ? "bg-campo"
            : info.ponto
        }`}
      />
      {s.nome}
    </span>
  );
}
