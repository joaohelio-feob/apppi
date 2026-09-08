"use client";

import { useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataLocalISO } from "@/lib/datas";
import type { Membro, Reuniao } from "@/lib/types";

export default function Reunioes() {
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [data, setData] = useState(dataLocalISO());
  const [pauta, setPauta] = useState("");
  const [presentes, setPresentes] = useState<string[]>([]);
  const [decisoes, setDecisoes] = useState("");

  const supabase = criarClienteNavegador();

  async function carregar() {
    const [{ data: r }, { data: m }] = await Promise.all([
      supabase.from("reunioes").select("*").order("data", { ascending: false }),
      supabase.from("membros").select("id, nome, papel").order("nome"),
    ]);
    setReunioes((r ?? []) as Reuniao[]);
    setMembros((m ?? []) as Membro[]);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function alternarPresente(id: string) {
    setPresentes((atual) => (atual.includes(id) ? atual.filter((p) => p !== id) : [...atual, id]));
  }

  async function registrar() {
    if (!pauta.trim()) {
      setErro("Descreva a pauta da reunião.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.from("reunioes").insert({
      data,
      pauta,
      presentes,
      decisoes: decisoes || null,
    });
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    setPauta("");
    setPresentes([]);
    setDecisoes("");
    carregar();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        Ata das reuniões da equipe
      </h1>
      <p className="mt-2 max-w-prose text-sm text-tinta/70">
        Registro mínimo: quando foi, o que pautou, quem estava e o que ficou decidido.
      </p>

      <div className="mt-6 border border-linha bg-casca p-4">
        <h2 className="font-display text-xs font-semibold text-tinta/70">Nova reunião</h2>
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-tinta/70">
            Data
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-1 w-full border border-linha bg-campo px-3 py-2 font-corpo text-sm text-tinta sm:w-48"
            />
          </label>
          <label className="block text-xs text-tinta/70">
            Pauta
            <textarea
              rows={2}
              value={pauta}
              onChange={(e) => setPauta(e.target.value)}
              placeholder="O que foi discutido, ajustes e desafios enfrentados…"
              className="mt-1 w-full border border-linha bg-campo px-3 py-2 text-sm text-tinta"
            />
          </label>
          <div>
            <p className="text-xs text-tinta/70">Presentes</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {membros.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => alternarPresente(m.id)}
                  className={`border px-2 py-1 text-xs ${
                    presentes.includes(m.id)
                      ? "border-tinta bg-tinta text-campo"
                      : "border-linha text-tinta/70 hover:bg-campo"
                  }`}
                >
                  {m.nome}
                </button>
              ))}
              {membros.length === 0 && <p className="text-xs text-tinta/70">Ninguém cadastrado ainda.</p>}
            </div>
          </div>
          <label className="block text-xs text-tinta/70">
            Decisões
            <textarea
              rows={2}
              value={decisoes}
              onChange={(e) => setDecisoes(e.target.value)}
              placeholder="O que ficou combinado (opcional)…"
              className="mt-1 w-full border border-linha bg-campo px-3 py-2 text-sm text-tinta"
            />
          </label>

          {erro && <p className="font-mono text-xs text-trigo">{erro}</p>}

          <button
            onClick={registrar}
            disabled={salvando}
            className="bg-tinta px-4 py-2 text-sm font-semibold text-campo hover:bg-musgo disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Registrar reunião"}
          </button>
        </div>
      </div>

      {carregando ? (
        <p className="mt-10 text-sm text-tinta/70">carregando…</p>
      ) : (
        <div className="mt-8 space-y-4">
          {reunioes.map((r) => (
            <article key={r.id} className="border border-linha bg-casca p-4">
              <p className="font-mono text-xs text-tinta/70">
                {new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR", {
                  weekday: "short", day: "2-digit", month: "short", year: "numeric",
                })}
              </p>
              <p className="mt-1 text-sm">{r.pauta}</p>
              {r.presentes.length > 0 && (
                <p className="mt-2 font-mono text-xs text-tinta/70">
                  presentes: {r.presentes.map((id) => membros.find((m) => m.id === id)?.nome ?? "?").join(", ")}
                </p>
              )}
              {r.decisoes && (
                <p className="mt-2 border-t border-linha pt-2 text-sm text-tinta/70">{r.decisoes}</p>
              )}
            </article>
          ))}
          {reunioes.length === 0 && (
            <p className="text-sm text-tinta/70">Nenhuma reunião registrada ainda.</p>
          )}
        </div>
      )}
    </div>
  );
}
