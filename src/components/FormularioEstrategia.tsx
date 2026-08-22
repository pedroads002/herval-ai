"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Info } from "lucide-react";
import {
  modoInicial,
  modosAtendimento,
  type ModoAtendimento,
} from "@/data/estrategia";
import { clinicasIniciais, type Clinica } from "@/data/clinicas";
import { especialidadePorId } from "@/data/especialidades";
import { profissionaisDaClinica } from "@/data/profissionais";
import { formatarMoeda } from "@/lib/formato";

const campoBase =
  "w-full rounded-controle border border-black/15 bg-herval-branco px-4 py-3 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

const rotuloBase = "mb-2 block text-sm font-bold text-herval-preto";

/** Campos de texto livre da ficha. O resto da ficha é lista, e não se digita. */
type CampoDeTexto = "historia" | "diferenciais" | "endereco" | "horarioFuncionamento";

export default function FormularioEstrategia() {
  const [clinicas, setClinicas] = useState<Clinica[]>(clinicasIniciais);
  const [clinicaId, setClinicaId] = useState(clinicasIniciais[0].id);
  const [modo, setModo] = useState<ModoAtendimento>(modoInicial);
  const [salvo, setSalvo] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpa o temporizador se a tela for fechada antes dos 2 segundos.
  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  const clinica =
    clinicas.find((c) => c.id === clinicaId) ?? clinicas[0];

  function alterar(campo: CampoDeTexto, valor: string) {
    setClinicas((atuais) =>
      atuais.map((c) => (c.id === clinicaId ? { ...c, [campo]: valor } : c)),
    );
  }

  // Só mostra a confirmação. Nada é enviado nem salvo.
  function salvar() {
    setSalvo(true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setSalvo(false), 2000);
  }

  const descricaoModo = modosAtendimento.find((m) => m.modo === modo)?.descricao;

  return (
    <div className="max-w-3xl space-y-8">
      {/* Modo de atendimento da IA */}
      <section className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
        <h2 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
          <span className="h-4 w-1 rounded-full bg-herval-verde" />
          Modo de atendimento da IA
        </h2>

        <div
          role="radiogroup"
          aria-label="Modo de atendimento da IA"
          className="mt-6 inline-flex flex-wrap gap-1 rounded-full border border-black/15 p-1"
        >
          {modosAtendimento.map(({ modo: opcao }) => {
            const ativo = opcao === modo;
            return (
              <button
                key={opcao}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setModo(opcao)}
                className={[
                  "rounded-full px-5 py-2 text-sm font-bold transition-colors",
                  ativo
                    ? "bg-herval-verde text-herval-preto"
                    : "text-black/60 hover:bg-black/5 hover:text-herval-preto",
                ].join(" ")}
              >
                {opcao}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-sm font-medium text-black/60">
          {descricaoModo}
        </p>

        <p className="mt-4 inline-flex items-start gap-2 rounded-controle bg-black/[0.04] px-4 py-3 text-xs font-medium text-black/70">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          O primeiro contato de lead novo é sempre humano, independente do modo
          selecionado.
        </p>
      </section>

      {/* Ficha da clínica */}
      <form
        className="space-y-8 rounded-card border border-black/10 bg-herval-branco p-8 shadow-card"
        onSubmit={(e) => e.preventDefault()}
      >
        <div>
          <label className={rotuloBase} htmlFor="clinica-da-ficha">
            Clínica
          </label>
          <select
            id="clinica-da-ficha"
            value={clinicaId}
            onChange={(e) => setClinicaId(Number(e.target.value))}
            className={campoBase}
          >
            {clinicas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} · {c.cidade}
                {c.ativa ? "" : " · contrato pausado"}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs font-medium text-black/50">
            Cada cliente tem a própria ficha. É dela que a equipe tira o que
            responder quando o lead pergunta preço, convênio ou endereço.
          </p>
        </div>

        <div>
          <label className={rotuloBase}>História da clínica</label>
          <textarea
            rows={4}
            value={clinica.historia}
            onChange={(e) => alterar("historia", e.target.value)}
            className={campoBase}
          />
        </div>

        <div>
          <label className={rotuloBase}>Diferenciais</label>
          <textarea
            rows={4}
            value={clinica.diferenciais}
            onChange={(e) => alterar("diferenciais", e.target.value)}
            className={campoBase}
          />
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <span className={rotuloBase}>Ticket médio</span>
            <p className="text-sm font-bold text-herval-preto">
              {clinica.ticketMedio === null
                ? "Sem histórico de venda ainda"
                : formatarMoeda(clinica.ticketMedio)}
            </p>
          </div>
          <div>
            <span className={rotuloBase}>Condições</span>
            <p className="text-sm font-medium text-black/70">
              Em até {clinica.parcelasMaximas}x ·{" "}
              {clinica.formasPagamento.join(", ")}
            </p>
          </div>
        </div>

        <div>
          <span className={rotuloBase}>Convênios</span>
          {clinica.convenios.length === 0 ? (
            <p className="text-sm font-medium text-black/55">
              Nenhum. Estética não costuma ter cobertura — dizer isso logo
              evita o lead agendar achando que o plano paga.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {clinica.convenios.map((convenio) => (
                <li key={convenio.nome} className="text-sm text-black/70">
                  <span className="font-bold text-herval-preto">
                    {convenio.nome}
                  </span>
                  {" · "}
                  {convenio.especialidadeIds.length === 0
                    ? "sem procedimento coberto"
                    : convenio.especialidadeIds
                        .map((id) => especialidadePorId(id)?.nome ?? "—")
                        .join(", ")}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <span className={rotuloBase}>Público-alvo</span>
          <p className="text-sm font-medium text-black/70">
            Classe {clinica.classes.join("/")} · de {clinica.faixaEtaria.de} a{" "}
            {clinica.faixaEtaria.ate} anos
          </p>
          <ul className="mt-2 space-y-1">
            {clinica.principaisDores.map((dor) => (
              <li key={dor} className="text-sm text-black/70">
                · {dor}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <span className={rotuloBase}>Procedimentos e valor da avaliação</span>
          <ul className="space-y-1.5">
            {clinica.procedimentos.map((procedimento) => {
              const especialidade = especialidadePorId(
                procedimento.especialidadeId,
              );
              const foco =
                procedimento.especialidadeId === clinica.tratamentoFocoId;
              return (
                <li
                  key={procedimento.especialidadeId}
                  className="flex flex-wrap items-center gap-2 text-sm text-black/70"
                >
                  <span className="font-bold text-herval-preto">
                    {especialidade?.nome ?? "Especialidade removida"}
                  </span>
                  {foco && (
                    <span className="rounded-full bg-herval-verde/15 px-2.5 py-0.5 text-[11px] font-bold text-herval-preto">
                      carro-chefe
                    </span>
                  )}
                  <span>
                    {procedimento.valorConsulta === null
                      ? "avaliação gratuita"
                      : `avaliação ${formatarMoeda(procedimento.valorConsulta)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <span className={rotuloBase}>Equipe</span>
          <p className="text-sm font-medium text-black/70">
            {profissionaisDaClinica(clinica.id)
              .map((p) => p.nome)
              .join(", ") || "Nenhum profissional cadastrado."}
          </p>
        </div>

        <div>
          <label className={rotuloBase}>Endereço</label>
          <input
            type="text"
            value={clinica.endereco}
            onChange={(e) => alterar("endereco", e.target.value)}
            className={campoBase}
          />
        </div>

        <div>
          <label className={rotuloBase}>Horário de funcionamento</label>
          <input
            type="text"
            value={clinica.horarioFuncionamento}
            onChange={(e) => alterar("horarioFuncionamento", e.target.value)}
            className={campoBase}
          />
        </div>

        <div className="flex items-center gap-4 border-t border-black/10 pt-6">
          <button
            type="button"
            onClick={salvar}
            className="rounded-full bg-herval-verde px-6 py-3 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro"
          >
            Salvar estratégia
          </button>

          {salvo ? (
            <span
              role="status"
              className="inline-flex items-center gap-1.5 rounded-full bg-herval-verde/15 px-3.5 py-2 text-xs font-bold text-herval-preto"
            >
              <Check className="h-4 w-4" />
              Salvo
            </span>
          ) : (
            <span className="text-xs font-medium text-black/45">
              Tela de demonstração: nada é salvo ainda.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
