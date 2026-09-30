"use client";

import Dialogo from "./ui/Dialogo";

/**
 * Confirmação de ação, no lugar de `window.confirm()`.
 *
 * O `confirm` nativo não aceita os tokens do tema, não é anunciado como
 * diálogo e — o que mais importa aqui — só cabe uma frase, então acaba
 * dizendo "tem certeza?" em vez de dizer o que vai acontecer.
 *
 * Arquivar é reversível, então isto é uma confirmação leve, não um alarme:
 * diz o que acontece, para onde a coisa vai e que dá para voltar. Nada de
 * vermelho, nada de "atenção".
 */
export default function ConfirmarAcao({
  titulo,
  descricao,
  rotuloConfirmar,
  executando,
  aoConfirmar,
  aoCancelar,
}: {
  titulo: string;
  /** O que acontece, para onde vai, e se dá para desfazer. */
  descricao: React.ReactNode;
  rotuloConfirmar: string;
  executando?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  return (
    <Dialogo titulo={titulo} aoFechar={aoCancelar} ocupado={executando}>
      <div>
        <h2
          id="confirmar-titulo"
          className="font-display text-lg font-semibold"
        >
          {titulo}
        </h2>
        <div className="mt-2 text-sm text-tinta/70">{descricao}</div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            onClick={aoConfirmar}
            disabled={executando}
            className="bg-tinta px-4 py-2 text-sm font-semibold text-campo transition-opacity duration-micro ease-entrada hover:bg-musgo disabled:opacity-50"
          >
            {executando ? "…" : rotuloConfirmar}
          </button>
          <button
            onClick={aoCancelar}
            disabled={executando}
            className="border border-linha px-4 py-2 text-sm transition-opacity duration-micro ease-entrada hover:bg-casca disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Dialogo>
  );
}
