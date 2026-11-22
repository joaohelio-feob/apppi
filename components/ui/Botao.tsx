import type { ButtonHTMLAttributes } from "react";

const CLASSES = {
  primario: "botao-primario",
  destaque: "botao-destaque",
  secundario: "botao-secundario",
  discreto: "botao-discreto",
};

export default function Botao({
  variante = "primario",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "destaque" | "secundario" | "discreto";
}) {
  return (
    <button
      type={type}
      className={`botao ${CLASSES[variante]} ${className}`}
      {...props}
    />
  );
}
