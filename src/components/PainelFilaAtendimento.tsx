"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { metasPadrao } from "@/data/metas";
import type { Clinica } from "@/data/clinicas";
import type { Agendamento } from "@/data/agendamentos";
import type { Lead } from "@/data/leads";
import {
  avisoDoHistorico,
  montarHistoricoDoBanco,
} from "@/lib/relatorios/historicoDoBanco";
import type { DadosDosRelatorios } from "@/lib/dados/relatorios";
import {
  aguardandoContato,
  ESPERA_CRITICA,
  montarAlertasDaFila,
  montarFila,
  montarResumoDaFila,
  type LinhaFila,
} from "@/lib/atendimento";
import { baseDeLeads, type Faixa } from "@/lib/relatorios";
import { formatarNumero } from "@/lib/formato";
import { duracao } from "@/lib/tempo";
import AvisoDeCorte from "@/components/AvisoDeCorte";
import {
  comPercentual,
  Kpi,
  Nome,
  Num,
  PontosDeAtencao,
  Tabela,
  Total,
  type Coluna,
} from "@/components/PecasDeRelatorio";

/**
 * A régua de recuperação (`lib/regua.ts`) conta tentativa por tentativa, com
 * canal e desfecho, e nada disso existe no banco. Sem fonte, a lista vai vazia
 * em vez de virar alerta calculado sobre nada.
 */
const SEM_RECUPERACOES: never[] = [];

export default function PainelFilaAtendimento({
  faixa,
  clinicas,
  mostrarSemAtividade,
  dados,
  leads,
  agendamentos,
  agora,
}: {
  faixa: Faixa;
  clinicas: Clinica[];
  mostrarSemAtividade: boolean;
  dados: DadosDosRelatorios;
  /** Os leads já convertidos pela tela, com o relógio dela. */
  leads: Lead[];
  agendamentos: Agendamento[];
  /** O instante de agora: `minutosAtras` conta minutos, não dias. */
  agora: Date;
}) {
  const calculado = useMemo(() => {
    const base = baseDeLeads(leads);

    // O índice é montado uma vez: cada clínica precisa consultar o histórico
    // lead a lead.
    const doBanco = montarHistoricoDoBanco(dados.leads, dados.eventos, agora);
    const indice = doBanco.historico;
    const nomes = new Map(
      dados.leads
        .filter((l) => (l.nome ?? "").trim() !== "")
        .map((l) => [l.id, (l.nome as string).trim()]),
    );

    const linhas = montarFila({
      leads: base,
      historico: indice,
      agendamentos,
      faixa,
      clinicas,
    });
    const resumo = montarResumoDaFila(linhas, base, indice, faixa);

    // Ao vivo: não olha o período nem a clínica escolhida, de propósito.
    const esperando = aguardandoContato(
      base.filter((l) => l.etapa === "Leads Recebidos"),
      indice,
      nomes,
    );

    const nomeDoCliente = (id: number) =>
      dados.clinicas.find((c) => c.id === id)?.nome ?? "Clínica removida";

    return {
      linhas,
      resumo,
      esperando,
      aviso: avisoDoHistorico(doBanco.desconhecidos),
      alertas: montarAlertasDaFila(
        linhas,
        esperando,
        resumo.percentualNaCauda,
        metasPadrao,
        nomeDoCliente,
        SEM_RECUPERACOES,
      ),
    };
  }, [dados, leads, agendamentos, agora, faixa, clinicas]);

  const { linhas, resumo, esperando, alertas } = calculado;

  const visiveis = mostrarSemAtividade
    ? linhas
    : linhas.filter((l) => l.recebidos > 0 || l.contatados > 0);
  const escondidas = linhas.length - visiveis.length;

  // Todos os clientes, e não os filtrados: este bloco é o estado de agora em
  // todas as clínicas, como o próprio cartão ao lado diz.
  const esperandoPorClinica = dados.clinicas
    .map((clinica) => ({
      clinica,
      leads: esperando.filter((l) => l.clinicaId === clinica.id),
    }))
    .filter((linha) => linha.leads.length > 0)
    .sort((a, b) => b.leads.length - a.leads.length);

  const mediana = resumo.resposta.mediana;
  const media = resumo.resposta.media;

  const comAlertaDeCauda = new Set(
    alertas
      .filter((a) => a.id.startsWith("cauda-"))
      .map((a) => Number(a.id.replace("cauda-", ""))),
  );

  const semMedidaDeTempo = resumo.resposta.atendidos === 0;

  return (
    <div className="space-y-8">
      <AvisoDeCorte aviso={calculado.aviso} />

      {/* KPIs do período */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo="Recebidos"
          valor={formatarNumero(resumo.recebidos)}
          detalhe={
            resumo.foraDaConta === 0
              ? "leads que chegaram no período, de qualquer origem"
              : `leads que chegaram no período, de qualquer origem · ${formatarNumero(
                  resumo.foraDaConta,
                )} de “Outros Contatos” fora da conta, porque ali não é paciente (é por isso que este número fica abaixo do total de leads da aba Funil)`
          }
        />
        <Kpi
          rotulo="Contatados"
          valor={formatarNumero(resumo.contatados)}
          detalhe={`${comPercentual(resumo.taxaDeContato)} dos recebidos · ${formatarNumero(
            resumo.recebidos - resumo.contatados,
          )} ainda sem contato · conta quem entrou em “Em Contato” e também quem já está numa etapa depois do contato`}
        />
        <Kpi
          rotulo="Tempo de resposta"
          valor={mediana === null ? "não medido" : duracao(mediana)}
          detalhe={
            mediana === null
              ? "mede da chegada do lead até o primeiro contato; nenhum lead do período foi contatado ainda, e o campo fica vazio em vez de mostrar zero, que seria lido como atendimento imediato"
              : `mediana da chegada até o primeiro contato, sobre ${formatarNumero(
                  resumo.resposta.atendidos,
                )} ${resumo.resposta.atendidos === 1 ? "lead com espera medida" : "leads com espera medida"}`
          }
          alerta={mediana !== null && mediana >= 120}
        />
        <Kpi
          rotulo="Agendados"
          valor={formatarNumero(resumo.agendados)}
          detalhe="desses leads, quantos marcaram consulta"
        />
      </div>

      {/* A média vive fora do card, como a legenda de "quem fechou": ela só faz
          sentido junto da explicação de por que é diferente da mediana. */}
      {media !== null && mediana !== null && (
        <p className="-mt-4 flex items-start gap-2 text-xs font-medium leading-relaxed text-black/50">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-bold text-herval-preto">
              Tempo de resposta
            </span>{" "}
            conta da chegada do lead até o primeiro contato — a entrada dele na
            etapa “Em Contato”, que é o que o sistema registra. Metade deles
            esperou até {duracao(mediana)}. A média é de {duracao(media)},
            puxada pelos {comPercentual(resumo.percentualNaCauda)} que esperaram
            mais de um dia. Quem ainda não foi contatado conta como esperando,
            não como atendido na hora. O limite desta medida: ela depende de o
            card passar por “Em Contato”. Lead atendido por telefone e com card
            parado aparece como demora; lead que a equipe puxou direto para
            Agendamento conta como contatado no volume, mas fica sem tempo
            medido aqui — por isso a mediana pode sair de menos gente do que o
            número de contatados. Fica fora da conta, pelo mesmo motivo, o lead
            cuja etapa foi corrigida depois por varredura: ali o registro tem a
            hora da correção, e não a hora do atendimento.
          </span>
        </p>
      )}

      {/* Estado ao vivo */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Kpi
          rotulo="Aguardando contato"
          valor={formatarNumero(esperando.length)}
          selo="Agora"
          alerta={esperando.some((l) => l.minutosDeEspera > ESPERA_CRITICA)}
          detalhe="leads em “Leads Recebidos” neste momento, em todas as clínicas — este número não muda com o filtro de período nem com a clínica selecionada"
        />

        <section className="rounded-card border border-black/10 bg-herval-branco p-6 shadow-card">
          <h3 className="text-xs font-bold uppercase tracking-wide text-black/45">
            Quem está esperando, por clínica
          </h3>

          {esperandoPorClinica.length === 0 ? (
            <p className="mt-4 text-sm font-medium text-black/60">
              Ninguém aguardando primeiro contato agora.
            </p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {esperandoPorClinica.map(({ clinica, leads }) => {
                const maisAntigo = leads[0];
                const critico = maisAntigo.minutosDeEspera > ESPERA_CRITICA;
                return (
                  <li
                    key={clinica.id}
                    className="flex items-baseline justify-between gap-4 text-sm"
                  >
                    <span className="font-medium text-black/70">
                      {clinica.nome}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-extrabold text-herval-preto">
                        {leads.length}
                      </span>
                      <span
                        className={[
                          "ml-2 text-xs font-bold",
                          critico ? "text-herval-vermelho" : "text-black/45",
                        ].join(" ")}
                      >
                        mais antigo: {duracao(maisAntigo.minutosDeEspera)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Pontos de atenção */}
      <PontosDeAtencao
        alertas={alertas}
        visiveis={metasPadrao.alertasVisiveis}
        legenda={`Lead parado há mais de um dia sem contato, lead com a tentativa de recuperação da régua vencida, e clínica cuja fatia de leads que esperaram 12h ou mais é ao menos ${metasPadrao.multiplicadorDaCauda} vezes a fatia da base no mesmo período. A comparação é com a base, e não com um número fixo: mês ruim para todo mundo é assunto de meta. Ficam de fora clínicas com menos de ${metasPadrao.amostraMinima} leads com espera medida ou menos de ${metasPadrao.minimoNaCauda} leads na cauda — um caso isolado não é padrão de atendimento. Dois dos três estão medidos. O de recuperação vencida depende de registro de ligação, que o sistema ainda não tem — não há como dizer que ele está em ordem, apenas que não foi verificado.`}
        vazio="Nenhuma clínica fora do padrão e nenhum lead parado há mais de um dia sem contato. A recuperação vencida não foi verificada: depende de registro de ligação, que o sistema ainda não tem."
      />

      {/* Tabela por clínica */}
      <Tabela
        titulo="Atendimento por clínica (leads do período)"
        legenda="Conta os leads pela safra: os que chegaram dentro do período escolhido, acompanhados até onde foram. Recebidos e agendados contam toda origem de lead, e só deixam de fora a etapa “Outros Contatos”, que é onde a clínica guarda quem não é paciente — por isso “Recebidos” fica abaixo do total de leads da aba Funil, que mostra a base inteira. Contatado é quem entrou na etapa “Em Contato” ou já está numa etapa depois do contato: quem a equipe atendeu por telefone e puxou direto para Agendamento também foi atendido. A mediana e a média contam só quem tem espera medida, ou seja quem passou pelo card “Em Contato” — para os outros o tempo fica não medido, e não zero, porque zero seria lido como atendimento imediato. Por isso a mediana pode sair de menos gente do que a coluna “Contatados”. Não há total de mediana porque mediana de medianas não é mediana — o número do topo é calculado sobre todos os leads juntos."
        cabecalhos={[
          "Clínica",
          "Recebidos",
          "Contatados",
          "% contato",
          "Mediana",
          "Média",
          "Agendados",
        ]}
        vazio={visiveis.length === 0}
      >
        {visiveis.map((linha) => (
          <tr key={linha.clinica.id} className="border-t border-black/[0.07]">
            <Nome clinica={linha.clinica.nome} ativa={linha.clinica.ativa} />
            <Num>{linha.recebidos}</Num>
            <Num>{linha.contatados}</Num>
            <Num>{comPercentual(linha.taxaDeContato)}</Num>
            <Num>
              {linha.resposta.mediana === null
                ? "—"
                : duracao(linha.resposta.mediana)}
            </Num>
            {/* O vermelho fica na média: é nela que a cauda aparece, e é a
                cauda que dispara o alerta desta clínica. */}
            <Num alerta={comAlertaDeCauda.has(linha.clinica.id)}>
              {linha.resposta.media === null
                ? "—"
                : duracao(linha.resposta.media)}
            </Num>
            <Num>{linha.agendados}</Num>
          </tr>
        ))}
        <Total linhas={visiveis} colunas={colunasFila(mediana, media)} />
      </Tabela>

      {escondidas > 0 && !mostrarSemAtividade && (
        <p className="text-xs font-medium text-black/45">
          {escondidas}{" "}
          {escondidas === 1 ? "clínica escondida" : "clínicas escondidas"} por
          não ter recebido lead no período.
        </p>
      )}

      {/* Distribuição da espera */}
      <section className="rounded-card border border-black/10 bg-herval-branco p-5 shadow-card md:p-8">
        <h2 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
          <span className="h-4 w-1 rounded-full bg-herval-verde" />
          Quanto cada lead esperou
        </h2>
        <p className="mt-2 text-xs font-medium leading-relaxed text-black/50">
          As mesmas faixas que os alertas usam. A primeira é a promessa da régua
          de atendimento: primeiro contato em até dez minutos.
        </p>

        {semMedidaDeTempo ? (
          <p className="mt-6 text-sm font-medium leading-relaxed text-black/60">
            Não medido. Esta distribuição conta quanto cada lead esperou até o
            primeiro contato, e nenhum lead do período foi contatado ainda. As
            faixas ficam em branco em vez de aparecerem zeradas, porque zero
            aqui seria lido como “ninguém esperou”.
          </p>
        ) : (
          <ul className="mt-7 space-y-4">
            {resumo.distribuicao.map(({ faixa: faixaDeEspera, quantidade }) => {
              const maior = Math.max(
                1,
                ...resumo.distribuicao.map((d) => d.quantidade),
              );
              const largura = Math.round((quantidade / maior) * 100);
              const ruim = faixaDeEspera.ate > ESPERA_CRITICA;

              return (
                <li key={faixaDeEspera.id}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm font-medium text-black/70">
                      {faixaDeEspera.rotulo}
                    </span>
                    <span className="text-sm font-extrabold tabular-nums text-herval-preto">
                      {formatarNumero(quantidade)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/5">
                    <div
                      className={[
                        "h-full rounded-full",
                        ruim ? "bg-herval-vermelho" : "bg-herval-verde",
                      ].join(" ")}
                      style={{ width: `${largura}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Mediana e média não somam nem se recalculam a partir das linhas: o rodapé
 * repete o número do conjunto, que já foi calculado sobre todos os leads.
 */
function colunasFila(
  mediana: number | null,
  media: number | null,
): Coluna<LinhaFila>[] {
  return [
    { tipo: "soma", valor: (l) => l.recebidos },
    { tipo: "soma", valor: (l) => l.contatados },
    { tipo: "taxa", parte: (l) => l.contatados, total: (l) => l.recebidos },
    { tipo: "texto", valor: () => (mediana === null ? "—" : duracao(mediana)) },
    { tipo: "texto", valor: () => (media === null ? "—" : duracao(media)) },
    { tipo: "soma", valor: (l) => l.agendados },
  ];
}
