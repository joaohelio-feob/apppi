export type Status = "pendente" | "fazendo" | "revisao" | "concluida";
export type Prioridade = "baixa" | "media" | "alta";

export const STATUS: { id: Status; nome: string; cor: string }[] = [
  { id: "pendente",  nome: "A fazer",    cor: "bg-linha text-tinta" },
  { id: "fazendo",   nome: "Fazendo",    cor: "bg-trigo text-tinta" },
  { id: "revisao",   nome: "Em revisão", cor: "bg-ferro text-campo" },
  { id: "concluida", nome: "Concluída",  cor: "bg-musgo text-campo" },
];

export const PRIORIDADES: { id: Prioridade; nome: string }[] = [
  { id: "baixa",  nome: "Baixa" },
  { id: "media",  nome: "Média" },
  { id: "alta",   nome: "Alta" },
];

export type Papel = "dev" | "doc" | "scrum" | "design";

export const PAPEIS: { id: Papel; nome: string }[] = [
  { id: "dev",    nome: "Desenvolvimento" },
  { id: "doc",    nome: "Documentação" },
  { id: "scrum",  nome: "Scrum Master" },
  { id: "design", nome: "Design" },
];

export type Unidade = "poo" | "modelagem" | "logica" | "bi" | "autoconhecimento" | "geral";

export const UNIDADES: { id: Unidade; nome: string }[] = [
  { id: "poo",              nome: "POO" },
  { id: "modelagem",        nome: "Modelagem" },
  { id: "logica",           nome: "Lógica" },
  { id: "bi",               nome: "BI" },
  { id: "autoconhecimento", nome: "Autoconhecimento" },
  { id: "geral",            nome: "Geral" },
];

// Unidades reais do PI, sem o "geral" — é o que liga cada frente à matéria
// correspondente pra provar no relatório final que todas foram trabalhadas.
export const UNIDADES_FRENTE = UNIDADES.filter((u) => u.id !== "geral");

export type CorFrente = "musgo" | "trigo" | "broto" | "ferro";

export const CORES_FRENTE: { id: CorFrente; nome: string }[] = [
  { id: "musgo", nome: "Musgo" },
  { id: "trigo", nome: "Trigo" },
  { id: "broto", nome: "Broto" },
  { id: "ferro", nome: "Ferro" },
];

// Classes inteiras por token — o Tailwind só reconhece o que aparece
// literalmente no código em build time. Nunca monte `border-${cor}` (ou
// `.replace()` numa classe existente) na mão: a classe some do CSS final
// porque o texto "bg-musgo" precisa existir de verdade em algum arquivo.
export const CLASSES_COR_FRENTE: Record<CorFrente, string> = {
  musgo: "border-musgo text-musgo",
  trigo: "border-trigo text-trigo",
  broto: "border-broto text-broto",
  ferro: "border-ferro text-ferro",
};

// Mesma cor, versão preenchida (bolinha/barra) — mapa próprio porque não dá
// pra derivar de CLASSES_COR_FRENTE em tempo de execução (ver comentário acima).
export const CLASSES_COR_FRENTE_PREENCHIDA: Record<CorFrente, string> = {
  musgo: "bg-musgo",
  trigo: "bg-trigo",
  broto: "bg-broto",
  ferro: "bg-ferro",
};

export type Frente = {
  id: number;
  nome: string;
  unidade: Unidade | null;
  cor: CorFrente;
  ordem: number;
  criado_em?: string;
};

export type Membro = { id: string; nome: string; papel: string; criado_em?: string; frente_id?: number | null };

export type Escopo = "frente" | "individual";

export const ESCOPOS: { id: Escopo; nome: string }[] = [
  { id: "individual", nome: "Individual" },
  { id: "frente",     nome: "Da frente" },
];

export type Tarefa = {
  id: number;
  titulo: string;
  descricao: string | null;
  criador_id: string | null;
  escopo: Escopo;
  frente_id: number | null;
  status: Status;
  prioridade: Prioridade;
  inicio: string | null;
  prazo: string | null;
  local_entrega: string | null;
  issue_numero: number | null;
  observacoes: string | null;
  subiu_git: boolean;
  arquivada: boolean;
  concluido_em: string | null;
  criado_em: string;
  atualizado_em: string;
  responsaveis?: { membro: Membro }[];
  frentes?: Frente | null;
};

/** Lista os responsáveis de uma tarefa, já achatada (sem o embed aninhado do Supabase). */
export function responsaveisDe(t: Tarefa): Membro[] {
  return (t.responsaveis ?? []).map((r) => r.membro).filter(Boolean);
}

export type Anexo = {
  id: number;
  tarefa_id: number;
  autor_id: string | null;
  nome: string;
  caminho: string;
  criado_em: string;
  membros?: Membro | null;
};

export type Reuniao = {
  id: number;
  data: string;
  pauta: string;
  presentes: string[];
  decisoes: string | null;
  criado_em: string;
};

export type Registro = {
  em: string;
  autor: string | null;
  papel: string | null;
  acao: string;
  campo: string | null;
  valor_antigo: string | null;
  valor_novo: string | null;
  tarefa: string | null;
  status_atual: Status | null;
  escopo: Escopo | null;
  frente: string | null;
  frente_unidade: Unidade | null;
};
