"use client";

import Link from "next/link";
import { CLASSES_PRIORIDADE, STATUS } from "@/lib/types";
import Dialogo from "./ui/Dialogo";
import Botao from "./ui/Botao";
import FluxoTarefa from "./ui/FluxoTarefa";
import {
  IconeAjuda,
  IconeAlerta,
  IconeCodigo,
  IconeEntregas,
  IconeFechar,
  IconeFrentes,
  IconeRetorno,
  IconeSprint,
  IconeTrilha,
  IconeUsuario,
} from "./ui/Icones";

const DESTINOS_PROFESSOR = [
  {
    href: "/relatorio",
    titulo: "Trilha de atividades",
    detalhe: "Histórico cronológico imutável gravado pelo banco + CSV/PDF.",
    icone: <IconeTrilha className="h-4 w-4 text-musgo" />,
  },
  {
    href: "/entregas",
    titulo: "Entregas finais",
    detalhe: "Lista de tudo que foi feito, responsáveis, datas e status no Git.",
    icone: <IconeEntregas className="h-4 w-4 text-musgo" />,
  },
  {
    href: "/sprint",
    titulo: "Sprint Report",
    detalhe: "Resumo por pessoa, unidade curricular e reuniões por período.",
    icone: <IconeSprint className="h-4 w-4 text-musgo" />,
  },
  {
    href: "/codigo",
    titulo: "Espelho do GitHub",
    detalhe: "Commits por integrante, Pull Requests e CI (somente leitura).",
    icone: <IconeCodigo className="h-4 w-4 text-musgo" />,
  },
];

export default function GuiaPIModal({ aoFechar }: { aoFechar: () => void }) {
  return (
    <Dialogo
      titulo="Guia rápido do Caderno de Campo"
      aoFechar={aoFechar}
      classe="m-auto max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-4xl overflow-y-auto rounded-xl border border-linha bg-papel p-6 text-tinta shadow-destaque"
    >
      <div className="flex items-start justify-between gap-4 border-b border-linha pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-broto/25 text-tinta">
            <IconeAjuda className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-extrabold tracking-tight">
              Guia do Caderno de Campo · PI
            </h2>
            <p className="text-sm text-tinta/70">
              Tudo que você precisa saber para organizar entregas e gerar provas
              para avaliação.
            </p>
          </div>
        </div>
        <Botao
          variante="discreto"
          onClick={aoFechar}
          aria-label="Fechar guia"
        >
          <IconeFechar className="h-4 w-4" />
          Fechar
        </Botao>
      </div>

      <div className="mt-5 space-y-6">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold">
              1. O ciclo completo de uma tarefa
            </h3>
            <span className="rounded-full border border-linha bg-casca px-2.5 py-0.5 font-mono text-xs text-tinta">
              Atalho global: tecla <kbd className="font-bold">N</kbd> cria tarefa
            </span>
          </div>
          <FluxoTarefa modo="guia" />
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-linha bg-campo/60 p-4">
            <div className="flex items-center gap-2">
              <IconeUsuario className="h-4 w-4 text-musgo" />
              <h3 className="font-display text-sm font-bold">
                Escopo Individual
              </h3>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-tinta/70">
              Tem no máximo <strong className="text-tinta">1 responsável</strong>.
              Você pode associar uma frente opcionalmente apenas para indicar a
              matéria (POO, Lógica, Modelagem, BI, Autoconhecimento).
            </p>
          </div>

          <div className="rounded-xl border border-linha bg-campo/60 p-4">
            <div className="flex items-center gap-2">
              <IconeFrentes className="h-4 w-4 text-ferro" />
              <h3 className="font-display text-sm font-bold">
                Escopo Da frente
              </h3>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-tinta/70">
              Pertence a uma frente inteira: ao criar, o banco atribui{" "}
              <strong className="text-tinta">todos os integrantes dela</strong>{" "}
              automaticamente. Quem entra na frente depois não herda tarefas
              antigas.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-linha bg-campo/50 p-4">
          <h3 className="font-display text-sm font-bold">
            2. Legenda visual de Status e Sinais
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {STATUS.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-linha bg-papel px-2.5 py-2"
              >
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${s.cor}`}
                >
                  {s.nome}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-tinta/70">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-linha bg-papel px-2.5 py-1">
              <span className="font-mono font-bold text-tinta">
                {CLASSES_PRIORIDADE.alta.glifo}
              </span>
              Prioridade alta
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-linha bg-papel px-2.5 py-1">
              <span className="font-mono font-bold text-tinta">
                {CLASSES_PRIORIDADE.media.glifo}
              </span>
              Média
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-linha bg-papel px-2.5 py-1">
              <span className="font-mono font-bold text-tinta">
                {CLASSES_PRIORIDADE.baixa.glifo}
              </span>
              Baixa
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-trigo bg-trigo/15 px-2.5 py-1 text-tinta">
              <IconeAlerta className="h-3.5 w-3.5" />
              <strong>!</strong> Prazo vencido
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-ferro bg-ferro/10 px-2.5 py-1 text-tinta">
              <IconeRetorno className="h-3.5 w-3.5" />
              <strong>↩</strong> Revisor pediu ajuste
            </span>
          </div>
        </section>

        <section>
          <h3 className="font-display text-sm font-bold">
            3. Onde o professor encontra as evidências do PI
          </h3>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            {DESTINOS_PROFESSOR.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                onClick={aoFechar}
                className="flex items-start gap-3 rounded-xl border border-linha bg-campo/60 p-3 transition-colors duration-micro ease-entrada hover:border-musgo hover:bg-casca"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-papel shadow-cartao">
                  {d.icone}
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-sm font-bold text-tinta">
                    {d.titulo} →
                  </span>
                  <span className="block text-xs text-tinta/70">
                    {d.detalhe}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </Dialogo>
  );
}
