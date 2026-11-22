import type { Status } from "@/lib/types";
import {
  IconeCheck,
  IconeEntregas,
  IconeGit,
  IconeMais,
  IconeQuadro,
  IconeRetorno,
  IconeRevisoes,
  IconeSetaDireita,
} from "./Icones";

const ETAPAS_GUIA = [
  {
    numero: "1",
    titulo: "Criar tarefa",
    detalhe: "Escolha escopo Individual ou Da frente, prazo e prioridade.",
    cor: "border-linha bg-casca text-tinta",
    icone: <IconeMais className="h-4 w-4" />,
  },
  {
    numero: "2",
    titulo: "Executar",
    detalhe: "Mova para Fazendo e marque os critérios - [ ] antes de salvar.",
    cor: "border-trigo bg-trigo/20 text-tinta",
    icone: <IconeQuadro className="h-4 w-4" />,
  },
  {
    numero: "3",
    titulo: "Entregar",
    detalhe: "Informe arquivo no Drive, o que mudou e se precisa de commit.",
    cor: "border-broto bg-broto/25 text-tinta",
    icone: <IconeEntregas className="h-4 w-4" />,
  },
  {
    numero: "4",
    titulo: "Revisar",
    detalhe: "Se houver revisor, ele aprova, comenta ou pede ajuste (↩).",
    cor: "border-ferro bg-ferro/15 text-tinta",
    icone: <IconeRevisoes className="h-4 w-4" />,
  },
  {
    numero: "5",
    titulo: "Prova no PI",
    detalhe: "Concluída! Tudo fica salvo na Trilha e no Sprint Report.",
    cor: "border-musgo bg-musgo text-campo",
    icone: <IconeCheck className="h-4 w-4" />,
  },
];

const ESTAGIOS_PROGRESSO: { id: Status; rotulo: string }[] = [
  { id: "pendente", rotulo: "1. A fazer" },
  { id: "fazendo", rotulo: "2. Fazendo" },
  { id: "revisao", rotulo: "3. Em revisão" },
  { id: "concluida", rotulo: "4. Concluída" },
];

type PropsGuia = {
  modo: "guia";
};

type PropsProgresso = {
  modo: "progresso";
  status: Status;
  pendenteGit?: boolean;
  temRevisor: boolean;
  souResponsavel: boolean;
  temAjustePendente?: boolean;
};

function calcularProximoPasso(props: PropsProgresso): {
  titulo: string;
  texto: string;
  destaque: string;
  icone: React.ReactNode;
} {
  if (props.status === "concluida") {
    return {
      titulo: "Tarefa concluída",
      texto: "Evidência registrada na Trilha, em Entregas e no Sprint Report.",
      destaque: "border-musgo bg-musgo/10",
      icone: <IconeCheck className="h-4 w-4 text-musgo" />,
    };
  }
  if (props.status === "revisao" && props.pendenteGit) {
    return {
      titulo: "Próximo passo: confirmar commit no Git",
      texto: props.souResponsavel
        ? "Suba o código no GitHub e clique em 'Confirmar commit' abaixo para liberar a revisão."
        : "Aguardando o responsável confirmar o commit no bloco de entregáveis para liberar a revisão.",
      destaque: "border-trigo bg-trigo/15",
      icone: <IconeGit className="h-4 w-4 text-tinta" />,
    };
  }
  if (props.status === "revisao") {
    return {
      titulo: "Próximo passo: avaliação do revisor",
      texto: "O revisor designado acessa a aba Revisões para aprovar, deixar observações ou pedir ajuste.",
      destaque: "border-ferro bg-ferro/10",
      icone: <IconeRevisoes className="h-4 w-4 text-ferro" />,
    };
  }
  if (props.temAjustePendente) {
    return {
      titulo: "Próximo passo: ajustar e reentregar",
      texto:
        "O revisor pediu ajuste ('Falta algo'). Veja a nota abaixo, corrija e clique em 'Entregar' novamente.",
      destaque: "border-trigo bg-trigo/15",
      icone: <IconeRetorno className="h-4 w-4 text-tinta" />,
    };
  }
  if (props.status === "fazendo") {
    return {
      titulo: "Próximo passo: concluir e entregar",
      texto: props.souResponsavel
        ? props.temRevisor
          ? "Marque os critérios concluídos e clique em 'Entregar' para enviar ao revisor."
          : "Marque os critérios e clique em 'Entregar'. Sem revisor, a tarefa conclui direto."
        : "Em andamento pelos responsáveis. Qualquer pessoa pode ajustar prazo, critérios ou revisor.",
      destaque: "border-broto bg-broto/15",
      icone: <IconeEntregas className="h-4 w-4 text-tinta" />,
    };
  }
  return {
    titulo: "Próximo passo: iniciar trabalho",
    texto: props.souResponsavel
      ? "Mude o status para 'Fazendo' quando começar (a data de início é preenchida automaticamente)."
      : "Defina responsável e prazo ou mude o status para 'Fazendo' ao iniciar.",
    destaque: "border-linha bg-casca/70",
    icone: <IconeQuadro className="h-4 w-4 text-tinta" />,
  };
}

export default function FluxoTarefa(props: PropsGuia | PropsProgresso) {
  if (props.modo === "guia") {
    return (
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ETAPAS_GUIA.map((etapa, indice) => (
          <li
            key={etapa.numero}
            className="relative flex flex-col rounded-xl border border-linha bg-papel p-3.5 shadow-cartao"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border font-mono text-xs font-bold ${etapa.cor}`}
              >
                {etapa.icone}
              </span>
              <span className="font-mono text-xs font-semibold text-tinta/70">
                Passo {etapa.numero}
              </span>
            </div>
            <h3 className="mt-2.5 font-display text-sm font-bold text-tinta">
              {etapa.titulo}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-tinta/70">
              {etapa.detalhe}
            </p>
            {indice < ETAPAS_GUIA.length - 1 && (
              <span
                aria-hidden="true"
                className="mt-2 hidden items-center justify-end text-tinta/70 lg:flex"
              >
                <IconeSetaDireita className="h-3.5 w-3.5" />
              </span>
            )}
          </li>
        ))}
      </ol>
    );
  }

  const indiceAtual = ESTAGIOS_PROGRESSO.findIndex(
    (e) => e.id === props.status,
  );
  const passo = calcularProximoPasso(props);

  return (
    <div className="mt-4 space-y-3">
      <ol
        aria-label="Etapas da tarefa"
        className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
      >
        {ESTAGIOS_PROGRESSO.map((estagio, i) => {
          const atual = i === indiceAtual;
          const passado = i < indiceAtual;
          return (
            <li
              key={estagio.id}
              aria-current={atual ? "step" : undefined}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-xs ${
                atual
                  ? "border-tinta bg-tinta font-semibold text-campo"
                  : passado
                    ? "border-musgo/40 bg-musgo/15 text-tinta"
                    : "border-linha bg-casca/50 text-tinta/70"
              }`}
            >
              {passado && <IconeCheck className="h-3.5 w-3.5 text-musgo" />}
              <span className="truncate">{estagio.rotulo}</span>
            </li>
          );
        })}
      </ol>

      <div
        className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${passo.destaque}`}
      >
        <span className="mt-0.5 shrink-0">{passo.icone}</span>
        <div className="min-w-0">
          <p className="font-display text-xs font-bold text-tinta">
            {passo.titulo}
          </p>
          <p className="mt-0.5 leading-relaxed text-tinta/70">{passo.texto}</p>
        </div>
      </div>
    </div>
  );
}
