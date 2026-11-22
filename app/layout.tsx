import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
} from "next/font/google";
import "./globals.css";
import Navegacao from "@/components/Navegacao";
import ToastProvider from "@/components/ToastProvider";
import NovaTarefaProvider from "@/components/NovaTarefaProvider";
import DetalheTarefaProvider from "@/components/DetalheTarefaProvider";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

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
    <html
      lang="pt-BR"
      className={`${display.variable} ${corpo.variable} ${mono.variable}`}
    >
      <body>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:border-musgo focus:bg-papel focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-cartao"
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
                className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6"
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
