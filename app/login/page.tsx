"use client";

import Botao from "@/components/ui/Botao";
import Campo from "@/components/ui/Campo";
import {
  IconeCaderno,
  IconeCheck,
  IconeQuadro,
  IconeRevisoes,
  IconeTrilha,
} from "@/components/ui/Icones";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase-browser";

const DIFERENCIAIS = [
  {
    titulo: "Quadro e prazos em tempo real",
    texto: "Acompanhe tarefas individuais ou da frente em um só lugar.",
    icone: <IconeQuadro className="h-4 w-4 text-broto" />,
  },
  {
    titulo: "Entregas com revisão entre pares",
    texto: "Registre arquivos do Drive, commits e feedback dos revisores.",
    icone: <IconeRevisoes className="h-4 w-4 text-broto" />,
  },
  {
    titulo: "Trilha pronta para avaliação",
    texto: "Histórico cronológico e Sprint Report exportáveis em CSV/PDF.",
    icone: <IconeTrilha className="h-4 w-4 text-broto" />,
  },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [cadastrando, setCadastrando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function enviar() {
    if (carregando) return;
    setErro(null);
    setMensagem(null);
    setCarregando(true);
    const supabase = criarClienteNavegador();

    const { data, error } = cadastrando
      ? await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome } },
        })
      : await supabase.auth.signInWithPassword({ email, password: senha });

    setCarregando(false);

    if (error) {
      setErro(
        error.message.includes("Invalid login")
          ? "E-mail ou senha não conferem. Confira e tente de novo."
          : error.message,
      );
      return;
    }
    if (cadastrando && !data.session) {
      setMensagem(
        "Confira seu e-mail para confirmar o cadastro antes de entrar.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[82dvh] max-w-4xl items-center justify-center py-6">
      <div className="w-full overflow-hidden rounded-xl border border-linha bg-papel shadow-destaque md:grid md:grid-cols-12">
        <aside className="flex flex-col justify-between bg-tinta p-7 text-campo sm:p-8 md:col-span-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-musgo text-campo">
                <IconeCaderno className="h-5 w-5" />
              </span>
              <span className="rounded-full bg-broto px-2.5 py-0.5 font-mono text-xs font-semibold text-tinta">
                PI · UNIFEOB
              </span>
            </div>

            <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight">
              Caderno de Campo
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-campo/85">
              O painel da equipe de Ciência da Computação para organizar
              tarefas, prazos, revisões e gerar evidências reais do Projeto
              Integrador.
            </p>
          </div>

          <ul className="mt-8 space-y-4 border-t border-campo/15 pt-6">
            {DIFERENCIAIS.map((d) => (
              <li key={d.titulo} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-campo/10">
                  {d.icone}
                </span>
                <div>
                  <p className="font-display text-sm font-bold text-campo">
                    {d.titulo}
                  </p>
                  <p className="text-xs leading-relaxed text-campo/80">
                    {d.texto}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <section className="p-7 sm:p-8 md:col-span-7">
          <div
            role="tablist"
            aria-label="Modo de acesso"
            className="flex gap-1 rounded-xl border border-linha bg-casca p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!cadastrando}
              onClick={() => {
                setCadastrando(false);
                setErro(null);
                setMensagem(null);
              }}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-micro ease-entrada ${
                !cadastrando
                  ? "bg-papel text-tinta shadow-cartao"
                  : "text-tinta/70 hover:text-tinta"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={cadastrando}
              onClick={() => {
                setCadastrando(true);
                setErro(null);
                setMensagem(null);
              }}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-micro ease-entrada ${
                cadastrando
                  ? "bg-papel text-tinta shadow-cartao"
                  : "text-tinta/70 hover:text-tinta"
              }`}
            >
              Criar conta
            </button>
          </div>

          <div className="mt-5">
            <h2 className="font-display text-xl font-bold text-tinta">
              {cadastrando ? "Primeiro acesso da equipe" : "Acesse seu painel"}
            </h2>
            <p className="mt-1 text-sm text-tinta/70">
              {cadastrando
                ? "Crie seu perfil para aparecer na Equipe e receber tarefas."
                : "Entre com seu e-mail e senha para acompanhar a semana."}
            </p>
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
          >
            {cadastrando && (
              <Campo
                titulo="Nome completo"
                ajuda="Use seu nome completo — ele aparece nos relatórios e para o professor."
              >
                <input
                  required
                  autoComplete="name"
                  placeholder="Ex.: Maria Clara Silva"
                  className="campo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </Campo>
            )}
            <Campo titulo="E-mail">
              <input
                required
                autoComplete="email"
                placeholder="seu.nome@sou.unifeob.edu.br"
                className="campo"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Campo>
            <Campo titulo="Senha">
              <input
                required
                autoComplete={cadastrando ? "new-password" : "current-password"}
                placeholder="••••••••"
                className="campo"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </Campo>

            {mensagem && (
              <p
                role="status"
                className="flex items-center gap-2 rounded-xl border border-musgo bg-musgo/10 px-3.5 py-2.5 text-sm font-medium text-tinta"
              >
                <IconeCheck className="h-4 w-4 shrink-0 text-musgo" />
                <span>{mensagem}</span>
              </p>
            )}
            {erro && (
              <p
                role="alert"
                className="rounded-xl border border-trigo bg-trigo/15 px-3.5 py-2.5 text-sm font-medium text-tinta"
              >
                {erro}
              </p>
            )}

            <Botao
              type="submit"
              variante="destaque"
              disabled={carregando}
              className="w-full"
            >
              {carregando
                ? cadastrando
                  ? "Criando conta…"
                  : "Entrando…"
                : cadastrando
                  ? "Criar conta na equipe"
                  : "Entrar no painel"}
            </Botao>
          </form>
        </section>
      </div>
    </div>
  );
}
