import type { ReactNode } from "react";

export default function Campo({
  titulo,
  children,
  ajuda,
}: {
  titulo: string;
  children: ReactNode;
  ajuda?: string;
}) {
  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium">
        {titulo}
        <span className="mt-1 block font-normal">{children}</span>
      </label>
      {ajuda && <p className="mt-1 text-xs text-tinta/70">{ajuda}</p>}
    </div>
  );
}
