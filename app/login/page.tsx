"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase-browser";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [cadastrando, setCadastrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function enviar() {
    setErro(null);
    setCarregando(true);
    const supabase = criarClienteNavegador();

    const { error } = cadastrando
      ? await supabase.auth.signUp({ email, password: senha, options: { data: { nome } } })
      : await supabase.auth.signInWithPassword({ email, password: senha });

    setCarregando(false);

    if (error) {
      setErro(
        error.message.includes("Invalid login")
          ? "E-mail ou senha não conferem. Confira e tente de novo."
          : error.message
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="text-sm text-tinta/70">
        Projeto Integrador · 2026
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold leading-none tracking-tight">
        Caderno de Campo
      </h1>
      <p className="mt-3 text-sm text-tinta/70">
        Onde a equipe registra o que combinou fazer — e o que de fato fez.
      </p>

      <div className="mt-8 space-y-3">
        {cadastrando && (
          <input
            className="w-full border border-linha bg-casca px-3 py-2 text-sm"
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        )}
        <input
          className="w-full border border-linha bg-casca px-3 py-2 text-sm"
          placeholder="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border border-linha bg-casca px-3 py-2 text-sm"
          placeholder="Senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
        />

        {erro && <p className="font-mono text-xs text-trigo">{erro}</p>}

        <button
          onClick={enviar}
          disabled={carregando}
          className="w-full bg-tinta px-4 py-2.5 text-sm font-semibold text-campo hover:bg-musgo disabled:opacity-50"
        >
          {carregando ? "Um instante…" : cadastrando ? "Criar conta" : "Entrar"}
        </button>

        <button
          onClick={() => { setCadastrando(!cadastrando); setErro(null); }}
          className="w-full text-xs text-tinta/70 underline underline-offset-4"
        >
          {cadastrando ? "já tenho conta" : "primeiro acesso? criar conta"}
        </button>
      </div>
    </div>
  );
}
