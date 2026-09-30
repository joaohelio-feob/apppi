import Botao from "./Botao";

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
      className="my-4 flex flex-wrap items-center gap-3 border-l-2 border-trigo bg-casca/40 px-3 py-2 text-sm"
    >
      <p>{mensagem}</p>
      {aoTentar && (
        <Botao variante="secundario" onClick={aoTentar}>
          Tentar novamente
        </Botao>
      )}
    </div>
  );
}
