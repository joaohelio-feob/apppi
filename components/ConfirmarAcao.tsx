"use client";

import Dialogo from "./ui/Dialogo";
import Botao from "./ui/Botao";
import { IconeAlerta } from "./ui/Icones";

/**
 * Confirmação de ação, no lugar de `window.confirm()`.
 * Diz o que acontece, para onde vai e se dá para voltar.
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
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-trigo/20 text-tinta">
            <IconeAlerta className="h-4 w-4" />
          </span>
          <div>
            <h2
              id="confirmar-titulo"
              className="font-display text-lg font-bold text-tinta"
            >
              {titulo}
            </h2>
            <div className="mt-2 text-sm leading-relaxed text-tinta/70">
              {descricao}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-linha pt-4">
          <Botao onClick={aoConfirmar} disabled={executando}>
            {executando ? "Processando…" : rotuloConfirmar}
          </Botao>
          <Botao
            variante="secundario"
            onClick={aoCancelar}
            disabled={executando}
          >
            Cancelar
          </Botao>
        </div>
      </div>
    </Dialogo>
  );
}
