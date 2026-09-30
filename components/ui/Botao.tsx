import type { ButtonHTMLAttributes } from "react";

const CLASSES = {
  primario: "botao-primario",
  secundario: "botao-secundario",
  discreto: "botao-discreto",
};

export default function Botao({
  variante = "primario",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "discreto";
}) {
  return (
    <button
      type={type}
      className={`botao ${CLASSES[variante]} ${className}`}
      {...props}
    />
  );
}
