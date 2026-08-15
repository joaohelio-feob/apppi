export type Status = "pendente" | "fazendo" | "revisao" | "concluida";
export type Prioridade = "baixa" | "media" | "alta";

export const STATUS: { id: Status; nome: string; cor: string }[] = [
  { id: "pendente",  nome: "A fazer",    cor: "bg-linha text-tinta" },
  { id: "fazendo",   nome: "Fazendo",    cor: "bg-trigo text-tinta" },
  { id: "revisao",   nome: "Em revisão", cor: "bg-ferro text-campo" },
  { id: "concluida", nome: "Concluída",  cor: "bg-musgo text-campo" },
];

export type Papel = "dev" | "doc" | "scrum" | "design";

export const PAPEIS: { id: Papel; nome: string }[] = [
  { id: "dev",    nome: "Desenvolvimento" },
  { id: "doc",    nome: "Documentação" },
  { id: "scrum",  nome: "Scrum Master" },
  { id: "design", nome: "Design" },
];

export type Membro = { id: string; nome: string; papel: string; criado_em?: string };

export type Tarefa = {
  id: number;
  titulo: string;
  descricao: string | null;
  responsavel_id: string | null;
  criador_id: string | null;
  status: Status;
  prioridade: Prioridade;
  inicio: string | null;
  prazo: string | null;
  local_entrega: string | null;
  observacoes: string | null;
  subiu_git: boolean;
  concluido_em: string | null;
  criado_em: string;
  atualizado_em: string;
  membros?: Membro | null;
};

export type Anexo = {
  id: number;
  tarefa_id: number;
  autor_id: string | null;
  nome: string;
  caminho: string;
  criado_em: string;
  membros?: Membro | null;
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
};
