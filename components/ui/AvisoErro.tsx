import Botao from "./Botao";
import { IconeAlerta } from "./Icones";

export default function AvisoErro({
  mensagem,
  aoTentar,
}: {
  mensagem: string;
  aoTentar?: () => void;
}) {
  return (
    <div
      role="alert"
      className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-trigo bg-trigo/15 px-4 py-3 text-sm text-tinta shadow-cartao"
    >
      <p className="flex items-center gap-2 font-medium">
        <IconeAlerta className="h-4 w-4 text-tinta" />
        <span>{mensagem}</span>
      </p>
      {aoTentar && (
        <Botao variante="secundario" onClick={aoTentar}>
          Tentar novamente
        </Botao>
      )}
    </div>
  );
}
