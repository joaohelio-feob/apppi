"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "onBlur"
> & {
  valor: string | number | null | undefined;
  aoSalvar: (valor: string) => Promise<boolean>;
};

export default function CampoTabela({ valor, aoSalvar, ...props }: Props) {
  const [rascunho, setRascunho] = useState(String(valor ?? ""));
  const [salvando, setSalvando] = useState(false);
  const editando = useRef(false);
  const aoEntrar = useRef("");
  const cancelado = useRef(false);
  const ultimoValor = useRef(valor);
  ultimoValor.current = valor;
  useEffect(() => {
    if (!editando.current) setRascunho(String(valor ?? ""));
  }, [valor]);
  return (
    <input
      {...props}
      value={rascunho}
      disabled={salvando || props.disabled}
      onFocus={() => {
        editando.current = true;
        aoEntrar.current = rascunho;
        cancelado.current = false;
      }}
      onChange={(e) => setRascunho(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelado.current = true;
          setRascunho(String(ultimoValor.current ?? ""));
          e.currentTarget.value = String(ultimoValor.current ?? "");
          e.currentTarget.blur();
        }
      }}
      onBlur={async (e) => {
        editando.current = false;
        const texto = e.currentTarget.value;
        if (cancelado.current || texto === aoEntrar.current) {
          setRascunho(String(ultimoValor.current ?? ""));
          return;
        }
        if (!e.currentTarget.checkValidity()) {
          setRascunho(String(ultimoValor.current ?? ""));
          return;
        }
        if (texto === String(ultimoValor.current ?? "")) return;
        setSalvando(true);
        const salvo = await aoSalvar(texto);
        setSalvando(false);
        if (!salvo) setRascunho(String(ultimoValor.current ?? ""));
      }}
    />
  );
}
