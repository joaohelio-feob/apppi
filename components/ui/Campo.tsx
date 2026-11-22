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
      <label className="block text-xs font-semibold text-tinta">
        {titulo}
        <span className="mt-1.5 block font-normal">{children}</span>
      </label>
      {ajuda && (
        <p className="mt-1.5 text-xs leading-relaxed text-tinta/70">{ajuda}</p>
      )}
    </div>
  );
}
