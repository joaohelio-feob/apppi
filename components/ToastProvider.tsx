"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type TipoAviso = "erro" | "info";
type Aviso = { id: number; mensagem: string; tipo: TipoAviso };
type ToastContexto = { avisar: (mensagem: string, tipo?: TipoAviso) => void };

const ToastContext = createContext<ToastContexto | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const avisar = useCallback((mensagem: string, tipo: TipoAviso = "erro") => {
    const id = Date.now() + Math.random();
    setAvisos((atual) => [...atual, { id, mensagem, tipo }]);
    setTimeout(() => setAvisos((atual) => atual.filter((a) => a.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ avisar }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        {avisos.map((a) => (
          <div
            key={a.id}
            className={`px-4 py-2 text-sm font-semibold shadow-lg ${
              a.tipo === "erro" ? "bg-trigo text-tinta" : "bg-tinta text-campo"
            }`}
          >
            {a.mensagem}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
