"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { useLeads } from "@/components/ProvedorLeads";
import { indexarLigacoes, ligacoesDoLead } from "@/data/ligacoes";
import { situacaoDaRegua } from "@/lib/regua";
import { clinicasIniciais, nomeDaClinica } from "@/data/clinicas";
import { historicoDeEtapasInicial, indexarPorLead } from "@/data/historicoEtapas";
import { metasPadrao } from "@/data/metas";
import type { Clinica } from "@/data/clinicas";
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

export default function PainelFilaAtendimento({
  faixa,
  clinicas,
  mostrarSemAtividade,
}: {
  faixa: Faixa;
  clinicas: Clinica[];
  mostrarSemAtividade: boolean;
}) {
  const { tarefas, ligacoes } = useLeads();

  const dados = useMemo(() => {
    const leads = baseDeLeads(tarefas);
    // O índice é montado uma vez: são catorze mil mudanças de etapa, e cada
    // clínica precisa consultar o histórico lead a lead.
    const indice = indexarPorLead(historicoDeEtapasInicial);
    const nomes = new Map(tarefas.map((t) => [t.id, t.lead]));

    const porLead = indexarLigacoes(ligacoes);
    const linhas = montarFila({
      leads,
      historico: indice,
      ligacoes: porLead,
      faixa,
      clinicas,
    });
    const resumo = montarResumoDaFila(linhas, leads, indice, porLead, faixa);

    // Ao vivo: não olha o período nem a clínica escolhida, de propósito.
    const esperando = aguardandoContato(
      leads.filter((l) => l.etapa === "Leads Recebidos"),
      indice,
      nomes,
    );

    // Também ao vivo: quem esgotou a rajada e está com a tentativa de
    // recuperação vencida. É estado calculado, não alarme agendado.
    const recuperacoes = tarefas
      .map((tarefa) => ({
        tarefa,
        situacao: situacaoDaRegua(
          ligacoesDoLead(porLead, tarefa.id),
          tarefa.etapa,
          metasPadrao,
        ),
      }))
      .filter(({ situacao }) => situacao.estado === "recuperacao-devida")
      .map(({ tarefa, situacao }) => ({
        id: tarefa.id,
        clinicaId: tarefa.clinicaId,
        nome: tarefa.lead,
        atraso: situacao.atrasoDaRecuperacao ?? 0,
      }))
      .sort((a, b) => b.atraso - a.atraso);

    return {
      linhas,
      resumo,
      esperando,
      alertas: montarAlertasDaFila(
        linhas,
        esperando,
        resumo.percentualNaCauda,
        metasPadrao,
        nomeDaClinica,
        recuperacoes,
      ),
    };
  }, [tarefas, ligacoes, faixa, clinicas]);

  const { linhas, resumo, esperando, alertas } = dados;

  const visiveis = mostrarSemAtividade
    ? linhas
    : linhas.filter((l) => l.recebidos > 0 || l.contatados > 0);
  const escondidas = linhas.length - visiveis.length;

  const esperandoPorClinica = clinicasIniciais
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

  return (
    <div className="space-y-8">
      {/* KPIs do período */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo="Recebidos"
          valor={formatarNumero(resumo.recebidos)}
          detalhe="leads de campanha paga que chegaram no período"
        />
        <Kpi
          rotulo="Contatados"
          valor={formatarNumero(resumo.contatados)}
          detalhe={`${comPercentual(resumo.taxaDeContato)} dos recebidos · ${formatarNumero(
            resumo.recebidos - resumo.contatados,
          )} ainda sem contato`}
        />
        <Kpi
          rotulo="Tempo de resposta"
          valor={mediana === null ? "sem amostra" : duracao(mediana)}
          detalhe={
            mediana === null
              ? "nenhum lead de campanha com ligação registrada no período — o campo fica vazio em vez de mostrar o número de outro recorte"
              : `mediana até a primeira tentativa de ligação, sobre ${formatarNumero(
                  resumo.resposta.atendidos,
                )} ${resumo.resposta.atendidos === 1 ? "lead" : "leads"} com ligação registrada`
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
            conta da chegada do lead até a primeira tentativa de ligação, que é
            a definição do sistema desde que a régua de ligação existe. Metade
            deles esperou até {duracao(mediana)}. A média é de {duracao(media)},
            puxada pelos {comPercentual(resumo.percentualNaCauda)} que esperaram
            mais de um dia. Só entram aqui os leads com ligação registrada:
            volume e tempo de resposta não saem da mesma base, porque o
            histórico antigo não tem registro de ligação.
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
        legenda={`Lead parado há mais de um dia sem contato, lead com a tentativa de recuperação da régua vencida, e clínica cuja fatia de leads que esperaram 12h ou mais é ao menos ${metasPadrao.multiplicadorDaCauda} vezes a fatia da base no mesmo período. A comparação é com a base, e não com um número fixo: mês ruim para todo mundo é assunto de meta. Ficam de fora clínicas com menos de ${metasPadrao.amostraMinima} leads contatados ou menos de ${metasPadrao.minimoNaCauda} leads na cauda — um caso isolado não é padrão de atendimento.`}
        vazio="Nenhum lead parado, nenhuma recuperação vencida e nenhuma clínica com cauda fora do padrão da base no período."
      />

      {/* Tabela por clínica */}
      <Tabela
        titulo="Atendimento por clínica (leads do período)"
        legenda="Conta os leads pela safra: os que chegaram dentro do período escolhido, acompanhados até onde foram. Recebidos, contatados e agendados contam a base inteira, e são os mesmos números dos Relatórios. Já a mediana e a média contam só os leads com ligação registrada, porque o tempo de resposta passou a ser medido da chegada até a primeira tentativa de ligação, e o histórico antigo não tem esse registro — por isso as colunas de tempo podem estar vazias onde há volume. A mediana resiste a um caso perdido; a média mostra quando existe cauda. Não há total de mediana porque mediana de medianas não é mediana — o número do topo é calculado sobre todos os leads juntos."
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
      <section className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
        <h2 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
          <span className="h-4 w-1 rounded-full bg-herval-verde" />
          Quanto cada lead esperou
        </h2>
        <p className="mt-2 text-xs font-medium leading-relaxed text-black/50">
          As mesmas faixas que os alertas usam. A primeira é a promessa da régua
          de automação: primeiro contato em até cinco minutos.
        </p>

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
