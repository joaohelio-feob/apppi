"use client";

import Botao from "@/components/ui/Botao";
import Campo from "@/components/ui/Campo";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase-browser";

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
    <div className="mx-auto flex min-h-[75dvh] max-w-sm flex-col justify-center px-6">
      <p className="text-sm text-tinta/70">Projeto Integrador · 2026</p>
      <h1 className="mt-2 font-display text-3xl font-semibold leading-none tracking-tight">
        Caderno de Campo
      </h1>
      <p className="mt-3 text-sm text-tinta/70">
        Organize tarefas, prazos e entregas do grupo.
      </p>

      <form
        className="mt-6 space-y-4 border-t border-linha pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        {cadastrando && (
          <Campo titulo="Nome">
            <input
              required
              autoComplete="name"
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
            className="campo"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </Campo>
        {mensagem && (
          <p role="status" className="text-sm">
            {mensagem}
          </p>
        )}
        {erro && (
          <p role="alert" className="border-l-2 border-trigo pl-3 text-sm">
            {erro}
          </p>
        )}
        <Botao type="submit" disabled={carregando} className="w-full">
          {carregando
            ? cadastrando
              ? "Criando conta…"
              : "Entrando…"
            : cadastrando
              ? "Criar conta"
              : "Entrar"}
        </Botao>
        <Botao
          variante="discreto"
          disabled={carregando}
          className="w-full"
          onClick={() => {
            setCadastrando(!cadastrando);
            setErro(null);
            setMensagem(null);
          }}
        >
          {cadastrando ? "Já tenho conta" : "Primeiro acesso? Criar conta"}
        </Botao>
      </form>
    </div>
  );
}
