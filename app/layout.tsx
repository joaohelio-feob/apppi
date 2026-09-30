import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Navegacao from "@/components/Navegacao";
import ToastProvider from "@/components/ToastProvider";
import NovaTarefaProvider from "@/components/NovaTarefaProvider";

import DetalheTarefaProvider from "@/components/DetalheTarefaProvider";

const corpo = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-corpo",
  weight: ["400", "500", "600", "700"],
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Caderno de Campo · PI",
  description: "Painel de tarefas da equipe do Projeto Integrador",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${corpo.variable} ${mono.variable}`}>
      <body>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-campo focus:p-3"
        >
          Pular para o conteúdo
        </a>
        <ToastProvider>
          <NovaTarefaProvider>
            <DetalheTarefaProvider>
              <Navegacao />
              <main
                id="conteudo"
                tabIndex={-1}
                className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6"
              >
                {children}
              </main>
            </DetalheTarefaProvider>
          </NovaTarefaProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
