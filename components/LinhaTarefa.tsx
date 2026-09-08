"use client";

import { useState } from "react";
import { dataLocalISO, diasEntre, estaAtrasada } from "@/lib/datas";
import { progressoCriterios } from "@/lib/criterios";
import {
  CLASSES_PRIORIDADE, PRIORIDADES, STATUS, responsaveisDe,
  type Frente, type Membro, type Tarefa,
} from "@/lib/types";
import DetalheTarefa from "./DetalheTarefa";

/**
 * Uma tarefa como linha de caderno, para filas onde o cartão pesa demais:
 * quatro itens tranquilos não precisam de quatro caixas iguais. O cartão
 * (CartaoTarefa) continua sendo o tratamento do que é urgente.
 *
 * Mesma gramática de sinais do cartão e do calendário: prioridade é forma
 * (glifo), atraso soma "!" por cima. Nada aqui depende de cor para ser lido.
 *
 * As três props de exibição existem para a linha servir a duas telas sem
 * virar dois componentes — o que criaria a segunda maneira de mostrar uma
 * tarefa. Todas têm default igual ao comportamento da home, então a home
 * não passa nenhuma delas e o HTML dela não muda.
 */
export default function LinhaTarefa({
  tarefa,
  aoAtualizar,
  membros,
  frentes,
  mostrarStatus = false,
  mostrarQuem = true,
  mostrarFrente = true,
}: {
  tarefa: Tarefa;
  aoAtualizar?: () => void;
  membros?: Membro[];
  frentes?: Frente[];
  /**
   * Ligue onde a consulta NÃO filtra concluídas. Na home ela filtra
   * (app/page.tsx: .neq("status","concluida")), então o sinal seria ruído;
   * na /frentes/[id] ela não filtra, e sem isto uma tarefa concluída ficaria
   * visualmente idêntica a uma pendente.
   */
  mostrarStatus?: boolean;
  /** Desligue quando o cabeçalho do grupo já é a pessoa. */
  mostrarQuem?: boolean;
  /** Desligue quando a tela inteira já é de uma frente só. */
  mostrarFrente?: boolean;
}) {
  const [aberto, setAberto] = useState(false);

  const hoje = dataLocalISO();
  const atrasada = estaAtrasada(tarefa.status, tarefa.prazo, hoje);
  const prio = CLASSES_PRIORIDADE[tarefa.prioridade];
  const nomePrio = PRIORIDADES.find((p) => p.id === tarefa.prioridade)?.nome ?? tarefa.prioridade;
  const nomeStatus = STATUS.find((s) => s.id === tarefa.status)?.nome ?? tarefa.status;
  const responsaveis = responsaveisDe(tarefa);
  const progresso = progressoCriterios(tarefa.descricao);

  const nomes = responsaveis.map((m) => m.nome);
  // Duas pessoas por extenso; a partir daí, a primeira e o resto contado.
  const quem =
    nomes.length === 0 ? "sem dono"
    : nomes.length <= 2 ? nomes.join(" e ")
    : `${nomes[0]} +${nomes.length - 1}`;

  const dias = tarefa.prazo ? diasEntre(tarefa.prazo, hoje) : null;
  const prazoCurto =
    dias === null ? "—"
    : atrasada ? `${Math.abs(dias)}d`
    : dias === 0 ? "hoje"
    : `${dias}d`;

  /**
   * Concluída troca o prazo por "✓": dias restantes de tarefa concluída não
   * informam nada, e a coluna de prazo é a única que existe em toda largura
   * — a faixa de metadados some abaixo de sm. O título fica no peso normal:
   * nesta tela o trabalho entregue é o resultado que se quer ver, não algo a
   * apagar.
   */
  const concluida = mostrarStatus && tarefa.status === "concluida";

  /**
   * "A fazer" é o estado default e marcar o normal é ruído; "Concluída" já
   * está dito pelo ✓. Sobram os dois estados intermediários, por extenso e
   * sem caixa — do mesmo jeito que "frente" já entra aqui.
   */
  const palavraStatus =
    mostrarStatus && (tarefa.status === "fazendo" || tarefa.status === "revisao")
      ? nomeStatus.toLowerCase()
      : null;

  // O separador " · " fica colado ao literal de cada parte, e não numa
  // expressão própria, porque é assim que o HTML da home continua igual ao
  // de antes destas props — React quebra `{" · "}` num nó de texto separado.
  const temFrente = mostrarFrente && !!tarefa.frentes;
  const antesDaFrente = mostrarQuem || !!palavraStatus;
  const antesDoProgresso = antesDaFrente || temFrente;

  // Tudo que a forma comunica, repetido em palavras — o rótulo não depende
  // de nenhuma das props acima: quem chega neste botão pelo teclado pode não
  // ter passado pelo cabeçalho do grupo que tornou o dado redundante.
  const rotulo =
    `${tarefa.titulo} · ${nomeStatus} · prioridade ${nomePrio}` +
    `${atrasada ? " · atrasada" : ""} · ${quem}` +
    `${tarefa.frentes ? ` · frente ${tarefa.frentes.nome}` : ""}` +
    `${tarefa.prazo ? ` · ${atrasada ? `${Math.abs(dias!)} dias de atraso` : dias === 0 ? "vence hoje" : `faltam ${dias} dias`}` : ""}` +
    `${progresso ? ` · ${progresso.feitos} de ${progresso.total} critérios` : ""}` +
    " · abrir detalhes";

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={rotulo}
        className="grid w-full grid-cols-[1.1rem_minmax(0,1fr)_auto] items-baseline gap-x-2 border-b border-linha py-2 text-left transition duration-150 hover:bg-casca focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-musgo sm:grid-cols-[1.1rem_minmax(0,1fr)_minmax(0,17rem)_auto]"
      >
        <span aria-hidden="true" className="font-mono text-xs text-tinta/70">
          {atrasada ? <span className="font-semibold text-tinta">!</span> : prio.glifo}
        </span>

        <span className="min-w-0 truncate text-sm">{tarefa.titulo}</span>

        {/* Metadados na mesma linha, não numa segunda: é o que mantém a linha
            com altura de linha. Abaixo de sm eles somem — largura ali é para
            o título. "frente" escrito por extenso é o que distingue pessoa de
            frente sem depender de cor nem de conhecer os nomes do time. */}
        <span className="hidden min-w-0 truncate text-xs text-tinta/70 sm:block">
          {mostrarQuem && quem}
          {palavraStatus && (mostrarQuem ? <> · {palavraStatus}</> : palavraStatus)}
          {temFrente && (
            antesDaFrente
              ? <> · frente {tarefa.frentes!.nome}</>
              : <>frente {tarefa.frentes!.nome}</>
          )}
          {progresso && (
            <>
              {antesDoProgresso ? " · " : null}
              <span className="font-mono">{progresso.feitos}/{progresso.total}</span>
            </>
          )}
        </span>

        {/* Atraso deixou de ser texto trigo sobre o fundo: 2,42:1 não é
            legível (o piso é 4,5:1). O trigo vira o FUNDO do marcador, com o
            texto em tinta — 6,12:1 —, então a cor continua significando
            atraso e passa a ser lida. Mesmo par que o selo "Fazendo" já usa. */}
        <span
          title={concluida ? "Concluída" : undefined}
          className={`shrink-0 font-mono text-xs tabular-nums ${
            atrasada ? "bg-trigo px-1 font-semibold text-tinta" : "text-tinta/70"
          }`}
        >
          {concluida ? "✓" : prazoCurto}
        </span>
      </button>

      {aberto && (
        <DetalheTarefa
          tarefa={tarefa}
          aoFechar={() => setAberto(false)}
          aoAtualizar={aoAtualizar}
          membrosIniciais={membros}
          frentesIniciais={frentes}
        />
      )}
    </>
  );
}
