import { Clock, MessageSquareQuote, Users, Wallet } from "lucide-react";
import Etiqueta from "@/components/Etiqueta";
import { especialidadesIniciais } from "@/data/especialidades";
import { profissionaisDaEspecialidade } from "@/data/profissionais";
import { clinicasQueOferecem, procedimentoDaClinica } from "@/data/clinicas";
import { formatarDuracao, formatarMoeda } from "@/lib/formato";

/**
 * O que cada clínica cobra pela avaliação deste procedimento, resumido. O
 * preço é de cada clínica, então aqui ele só pode aparecer como faixa — não
 * existe "o valor" da harmonização facial, existe o valor em cada lugar.
 */
function resumoDaAvaliacao(especialidadeId: number) {
  const clinicas = clinicasQueOferecem(especialidadeId);
  if (clinicas.length === 0) return "Nenhuma clínica oferece";

  const valores = clinicas.map(
    (c) => procedimentoDaClinica(c, especialidadeId)?.valorConsulta ?? null,
  );
  const gratuitas = valores.filter((v) => v === null).length;
  const cobrados = valores.filter((v): v is number => v !== null);

  if (cobrados.length === 0) return `Gratuita nas ${gratuitas} clínicas`;

  const menor = formatarMoeda(Math.min(...cobrados));
  const maior = formatarMoeda(Math.max(...cobrados));
  const faixa = menor === maior ? menor : `${menor} a ${maior}`;

  if (gratuitas === 0) return faixa;
  return `Gratuita em ${gratuitas} · ${faixa} nas demais`;
}

export default function ListaEspecialidades() {
  const ativas = especialidadesIniciais.filter((e) => e.ativa).length;

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-black/55">
        <span className="font-extrabold text-herval-preto">{ativas}</span> de{" "}
        <span className="font-extrabold text-herval-preto">
          {especialidadesIniciais.length}
        </span>{" "}
        especialidades ativas. A IA só oferece e agenda as ativas.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {especialidadesIniciais.map((especialidade) => {
          const equipe = profissionaisDaEspecialidade(especialidade.id);

          return (
            <article
              key={especialidade.id}
              className={[
                "rounded-card border bg-herval-branco p-6 shadow-card",
                especialidade.ativa
                  ? "border-black/10"
                  : "border-dashed border-black/20 opacity-75",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg font-extrabold tracking-tight text-herval-preto">
                  {especialidade.nome}
                </h2>
                <Etiqueta
                  texto={especialidade.ativa ? "Ativa" : "Inativa"}
                  tom={especialidade.ativa ? "verde" : "preto"}
                />
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-black/45">
                    <Wallet className="h-3.5 w-3.5" />
                    Avaliação
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-herval-preto">
                    {resumoDaAvaliacao(especialidade.id)}
                  </dd>
                </div>

                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-black/45">
                    <Clock className="h-3.5 w-3.5" />
                    Duração
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-herval-preto">
                    {formatarDuracao(especialidade.duracaoMinutos)}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 rounded-controle bg-black/[0.03] p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-black/45">
                  <MessageSquareQuote className="h-3.5 w-3.5" />
                  Como a IA deve abordar
                </p>
                <p className="mt-2 text-sm leading-relaxed text-black/70">
                  {especialidade.comoAbordar}
                </p>
              </div>

              <div className="mt-5">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-black/45">
                  <Users className="h-3.5 w-3.5" />
                  Quem atende ({equipe.length})
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {equipe.map((profissional) => (
                    <span
                      key={profissional.id}
                      className="rounded-full bg-herval-verde/15 px-2.5 py-1 text-xs font-bold text-herval-preto"
                    >
                      {profissional.nome}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-xs font-medium text-black/45">
        A lista de quem atende vem da tela de Profissionais: para mudar aqui,
        mude a especialidade lá no cadastro do profissional. O valor da
        avaliação é de cada clínica e se edita na ficha dela, em Estratégia da
        Clínica — por isso aqui ele aparece como faixa.
      </p>
    </div>
  );
}
