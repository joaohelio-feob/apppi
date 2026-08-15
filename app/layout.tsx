import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navegacao from "@/components/Navegacao";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", weight: ["600", "800"] });
const corpo   = Inter({ subsets: ["latin"], variable: "--font-corpo" });
const mono    = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "600"] });

export const metadata: Metadata = {
  title: "Caderno de Campo · PI",
  description: "Painel de tarefas da equipe do Projeto Integrador",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${corpo.variable} ${mono.variable}`}>
      <body>
        <Navegacao />
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
