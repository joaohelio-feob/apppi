"use client";

import AvisoErro from "@/components/ui/AvisoErro";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import Botao from "@/components/ui/Botao";
import { useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase-browser";
import { dataLocalISO } from "@/lib/datas";
import type { Membro, Reuniao } from "@/lib/types";
import {
  IconeCheck,
  IconeMais,
  IconeReunioes,
} from "@/components/ui/Icones";

export default function Reunioes() {
  const [erroCarga, setErroCarga] = useState(false);
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
    const [{ data: r, error: erroR }, { data: m, error: erroM }] =
      await Promise.all([
        supabase.from("reunioes").select("*").order("data", { ascending: false }),
        supabase.from("membros").select("id, nome, papel").order("nome"),
      ]);
    setErroCarga(!!(erroR || erroM));
    if (erroR || erroM) {
      setCarregando(false);
      return;
    }
    setReunioes((r ?? []) as Reuniao[]);
    setMembros((m ?? []) as Membro[]);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function alternarPresente(id: string) {
    setPresentes((atual) =>
      atual.includes(id) ? atual.filter((p) => p !== id) : [...atual, id],
    );
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
    if (error) {
      setErro(error.message);
      return;
    }
    setPauta("");
    setPresentes([]);
    setDecisoes("");
    carregar();
  }

  return (
    <div>
      <CabecalhoPagina
        categoria="Atas da equipe"
        icone={<IconeReunioes className="h-3.5 w-3.5 text-musgo" />}
        titulo="Reuniões"
        contagem={!carregando ? `${reunioes.length} atas` : undefined}
        descricao="Registro objetivo das reuniões: quando aconteceu, o que foi pautado, quem participou e quais decisões foram tomadas."
      />

      <div className="cartao mb-6 p-5">
        <h2 className="mb-4 border-b border-linha pb-2 font-display text-base font-bold text-tinta">
          Registrar nova reunião
        </h2>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <label className="block text-xs font-semibold text-tinta/70">
              Data
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="campo mt-1.5 font-mono"
              />
            </label>
            <div className="sm:col-span-3">
              <p className="text-xs font-semibold text-tinta/70">Presentes</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {membros.map((m) => {
                  const marcado = presentes.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() => alternarPresente(m.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-micro ease-entrada ${
                        marcado
                          ? "border-musgo bg-musgo text-campo"
                          : "border-linha bg-campo text-tinta/70 hover:bg-casca hover:text-tinta"
                      }`}
                    >
                      {marcado && <IconeCheck className="h-3 w-3" />}
                      {m.nome}
                    </button>
                  );
                })}
                {membros.length === 0 && (
                  <p className="text-xs text-tinta/70">
                    Ninguém cadastrado ainda.
                  </p>
                )}
              </div>
            </div>
          </div>

          <label className="block text-xs font-semibold text-tinta/70">
            Pauta
            <textarea
              rows={2}
              value={pauta}
              onChange={(e) => setPauta(e.target.value)}
              placeholder="O que foi discutido, ajustes e desafios enfrentados…"
              className="campo mt-1.5"
            />
          </label>

          <label className="block text-xs font-semibold text-tinta/70">
            Decisões combinadas
            <textarea
              rows={2}
              value={decisoes}
              onChange={(e) => setDecisoes(e.target.value)}
              placeholder="O que ficou combinado (opcional)…"
              className="campo mt-1.5"
            />
          </label>

          {erro && (
            <p className="rounded-lg border border-trigo bg-trigo/15 px-3 py-2 font-mono text-xs text-tinta">
              {erro}
            </p>
          )}

          <Botao variante="destaque" onClick={registrar} disabled={salvando}>
            <IconeMais className="h-4 w-4" />
            {salvando ? "Salvando…" : "Registrar reunião"}
          </Botao>
        </div>
      </div>

      {erroCarga && (
        <AvisoErro
          mensagem="Não foi possível carregar os dados. Tente novamente."
          aoTentar={carregar}
        />
      )}
      {carregando ? (
        <p className="mt-10 text-sm text-tinta/70">Carregando reuniões…</p>
      ) : erroCarga ? null : (
        <div className="space-y-4">
          {reunioes.map((r) => (
            <article key={r.id} className="cartao p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-casca px-3 py-0.5 font-mono text-xs font-semibold text-tinta">
                  {new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                {r.presentes.length > 0 && (
                  <span className="font-mono text-xs text-tinta/70">
                    {r.presentes.length}{" "}
                    {r.presentes.length === 1 ? "presente" : "presentes"}
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm leading-relaxed text-tinta">
                {r.pauta}
              </p>

              {r.presentes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.presentes.map((id) => (
                    <span
                      key={id}
                      className="rounded-full border border-linha bg-campo px-2.5 py-0.5 text-xs text-tinta/70"
                    >
                      {membros.find((m) => m.id === id)?.nome ?? "?"}
                    </span>
                  ))}
                </div>
              )}

              {r.decisoes && (
                <div className="mt-3 rounded-xl border border-linha border-l-4 border-l-musgo bg-musgo/10 px-3.5 py-2.5">
                  <p className="font-display text-xs font-bold text-musgo">
                    Decisões
                  </p>
                  <p className="mt-0.5 text-sm text-tinta">{r.decisoes}</p>
                </div>
              )}
            </article>
          ))}
          {reunioes.length === 0 && (
            <div className="cartao p-8 text-center text-sm text-tinta/70">
              Nenhuma reunião registrada ainda.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
