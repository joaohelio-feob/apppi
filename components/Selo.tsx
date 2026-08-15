import { STATUS, type Status } from "@/lib/types";

export default function Selo({ status }: { status: Status }) {
  const s = STATUS.find((x) => x.id === status) ?? STATUS[0];
  return (
    <span className={`px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${s.cor}`}>
      {s.nome}
    </span>
  );
}
