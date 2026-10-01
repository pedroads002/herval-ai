"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Info } from "lucide-react";
import {
  CLASSES_ECONOMICAS,
  FORMAS_DE_PAGAMENTO,
  OBJETIVOS_DE_ATENDIMENTO,
  POLITICAS_DE_VALORES,
  PRIORIDADES_COMERCIAIS,
  QUANDO_A_AVALIACAO_E_COBRADA,
  TIPOS_DE_AVALIACAO,
  type ClienteDoSeletor,
  type FichaDaEstrategia,
} from "@/lib/dados/fichaDaEstrategia";

/**
 * A tela da Estratégia do Cliente.
 *
 * Nesta fase ela só LÊ. Mostra, nos cinco blocos, o que está gravado em
 * `clinicas` para o cliente escolhido — e diz, em cima, que ainda não grava.
 * Não há botão de salvar de propósito: o botão anterior não gravava nada e só
 * acendia um "Salvo" verde, que é o tipo de coisa que faz alguém preencher uma
 * ficha inteira e acreditar que cadastrou.
 *
 * O tipo vem de `fichaDaEstrategia.ts`, nunca de `estrategiaDoCliente.ts`:
 * importar do módulo de leitura arrastaria o cliente do Supabase para o pacote
 * do navegador.
 *
 * Campo em branco aparece como "(não cadastrado)" com todas as letras, igual ao
 * que a Helô recebe. É para quem escreve a estratégia ver a mesma lacuna que ela
 * vê, e não um espaço vazio que pode passar por preenchido.
 */

const campoBase =
  "w-full rounded-controle border border-black/15 bg-herval-branco px-4 py-3 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

const rotuloBase = "mb-2 block text-sm font-bold text-herval-preto";

const NAO_CADASTRADO = "(não cadastrado)";
const NADA_REGISTRADO = "(nada registrado)";

export default function FormularioEstrategia({
  clientes,
  ficha,
  nomesDeProcedimentos,
  falha,
}: {
  clientes: ClienteDoSeletor[];
  ficha: FichaDaEstrategia | null;
  nomesDeProcedimentos: Record<string, string>;
  falha: string | null;
}) {
  const router = useRouter();
  const [trocando, iniciarTroca] = useTransition();

  // Falha de leitura não é cliente sem estratégia. Sem esta distinção, banco
  // fora do ar e ficha realmente em branco viram a mesma tela — e a primeira é
  // defeito, que alguém leria como "este cliente não tem estratégia".
  if (falha) {
    return (
      <div className="rounded-card border border-herval-vermelho/30 bg-herval-vermelho/5 px-5 py-6">
        <p className="text-sm font-bold text-herval-preto">
          Não deu para carregar a estratégia.
        </p>
        <p className="mt-1 text-sm font-medium text-black/60">{falha}</p>
      </div>
    );
  }

  if (ficha === null) {
    return (
      <Bloco titulo="Estratégia do Cliente">
        <p className="text-sm font-medium text-black/55">
          Nenhum cliente cadastrado ainda.
        </p>
        <p className="mt-2 text-xs font-medium text-black/45">
          A estratégia é de um cliente: ela aparece aqui assim que existir um em
          Clientes.
        </p>
      </Bloco>
    );
  }

  /*
    Trocar de cliente é trocar de URL, não mexer em estado local. É o que faz o
    link `?cliente=19` abrir na ficha certa quando alguém o manda para outra
    pessoa — e é o servidor que lê o banco, então a troca tem de chegar até lá.
  */
  function trocarDeCliente(id: string) {
    iniciarTroca(() => router.push(`/estrategia?cliente=${id}`));
  }

  return (
    <div className="max-w-3xl space-y-8">
      <Bloco titulo="Cliente">
        <label className={rotuloBase} htmlFor="cliente-da-estrategia">
          De quem é esta estratégia
        </label>
        <select
          id="cliente-da-estrategia"
          value={ficha.clienteId}
          disabled={trocando}
          onChange={(e) => trocarDeCliente(e.target.value)}
          className={campoBase}
        >
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nome}
              {cliente.cidade ? ` · ${cliente.cidade}` : ""}
              {cliente.ativa ? "" : " · contrato pausado"}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs font-medium text-black/50">
          Cada cliente tem a própria estratégia. Clientes diz quem ele é,
          Procedimentos diz o que ele oferece, e aqui está como a operação
          comercial dele funciona.
        </p>

        <p className="mt-5 inline-flex items-start gap-2 rounded-controle bg-black/[0.04] px-4 py-3 text-xs font-medium text-black/70">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Esta tela já mostra o que está gravado no banco, o mesmo que a Helô
          lê. Ainda não dá para editar aqui — a gravação é o próximo passo.
        </p>
      </Bloco>

      {/* 1 — Objetivo do Atendimento */}
      <Bloco
        titulo="Objetivo do Atendimento"
        explicacao="Para onde a Helô conduz a conversa. Sem isto cadastrado, ela tenta marcar avaliação por padrão."
      >
        <Linha
          rotulo="Objetivo principal"
          valor={ficha.objetivo}
          opcoes={OBJETIVOS_DE_ATENDIMENTO}
        />
        <Linha
          rotulo="Prioridade comercial"
          valor={ficha.prioridade}
          opcoes={PRIORIDADES_COMERCIAIS}
        />
        {ficha.objetivo === "Encaminhar para humano" && (
          <p className="text-xs font-medium text-black/60">
            Com este objetivo a Helô não tenta marcar: ela acolhe, entende o
            pedido e passa para a equipe.
          </p>
        )}
      </Bloco>

      {/* 2 — Avaliação/Consulta */}
      <Bloco
        titulo="Avaliação / Consulta"
        explicacao="O que vem antes do procedimento. São regras, não preço: nenhum campo aqui guarda valor."
      >
        <Linha
          rotulo="Tem avaliação inicial"
          valor={simOuNao(ficha.temAvaliacaoInicial)}
        />
        <Linha
          rotulo="Tipo"
          valor={ficha.tipoDeAvaliacao}
          opcoes={TIPOS_DE_AVALIACAO}
        />
        <Linha rotulo="É gratuita" valor={simOuNao(ficha.avaliacaoGratuita)} />
        <Linha
          rotulo="Quando é cobrada"
          valor={ficha.quandoCobrada}
          opcoes={QUANDO_A_AVALIACAO_E_COBRADA}
        />
        <Linha
          rotulo="O que for pago abate no procedimento"
          valor={simOuNao(ficha.avaliacaoAbateNoProcedimento)}
        />
        <Linha
          rotulo="A Helô pode falar de valor"
          valor={simOuNao(ficha.heloPodeInformarValor)}
        />
      </Bloco>

      {/* 3 — Condições Comerciais */}
      <Bloco
        titulo="Condições Comerciais"
        explicacao="Como o cliente recebe. O número exato de qualquer coisa continua vindo da equipe — a Helô confirma, não cota."
      >
        <ListaMarcada
          rotulo="Formas de pagamento"
          marcados={ficha.formasDePagamento}
          todas={FORMAS_DE_PAGAMENTO}
        />
        <Linha
          rotulo="Parcelamento máximo"
          valor={
            ficha.parcelamentoMaximo === null
              ? null
              : `em até ${ficha.parcelamentoMaximo}x`
          }
        />
        <div>
          <span className={rotuloBase}>Convênios</span>
          {ficha.convenios.length === 0 ? (
            <p className="text-sm font-medium text-black/55">
              {NAO_CADASTRADO} — e isto não é o mesmo que &ldquo;não aceita
              convênio&rdquo;. A Helô trata campo vazio como algo que vai
              confirmar com a equipe.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {ficha.convenios.map((convenio) => (
                <li key={convenio.nome} className="text-sm text-black/70">
                  <span className="font-bold text-herval-preto">
                    {convenio.nome}
                  </span>
                  {" · "}
                  {convenio.especialidadeIds.length === 0
                    ? "nenhum procedimento coberto"
                    : convenio.especialidadeIds
                        .map(
                          (id) =>
                            nomesDeProcedimentos[String(id)] ??
                            "procedimento removido",
                        )
                        .join(", ")}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Linha
          rotulo="Política de valores"
          valor={ficha.politicaDeValores}
          opcoes={POLITICAS_DE_VALORES}
        />
      </Bloco>

      {/* 4 — Público-alvo */}
      <Bloco
        titulo="Público-alvo"
        explicacao="Com quem este cliente quer falar. Serve de tom, não de filtro: a Helô não recusa ninguém por causa disto."
      >
        <ListaMarcada
          rotulo="Classe econômica"
          marcados={ficha.classes}
          todas={CLASSES_ECONOMICAS}
        />
        <Linha rotulo="Faixa etária" valor={faixaEtaria(ficha)} />
        <div>
          <span className={rotuloBase}>Principais dores</span>
          {ficha.principaisDores.length === 0 ? (
            <p className="text-sm font-medium text-black/55">
              {NAO_CADASTRADO}
            </p>
          ) : (
            <ul className="space-y-1">
              {ficha.principaisDores.map((dor) => (
                <li key={dor} className="text-sm text-black/70">
                  · {dor}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Bloco>

      {/* 5 — Diretrizes de Comunicação */}
      <Bloco
        titulo="Diretrizes de Comunicação"
        explicacao="Como a Helô fala em nome deste cliente. Nenhum destes campos é obrigatório."
      >
        <Linha rotulo="Tom predominante" valor={ficha.tomPredominante} />
        <Paragrafo rotulo="Diferenciais" valor={ficha.diferenciais} />
        <Paragrafo
          rotulo="Informações a evitar"
          valor={ficha.informacoesAEvitar}
          vazio={NADA_REGISTRADO}
          observacao="A Helô recebe isto junto das travas, perto do topo do que ela não pode dizer."
        />
        <Paragrafo
          rotulo="Observações de atendimento"
          valor={ficha.observacoesDeAtendimento}
          vazio={NADA_REGISTRADO}
        />
        <Paragrafo rotulo="História" valor={ficha.historia} />
      </Bloco>

      {/*
        Endereço e horário são da ficha de Clientes, e é lá que se mudam. Ficam
        aqui porque a Helô fala os dois com o paciente, e quem escreve a
        estratégia precisa ver o que ela diria.
      */}
      <Bloco
        titulo="Do cadastro de Clientes"
        explicacao="Só exibição. Para mudar qualquer um dos dois, é na ficha do cliente em Clientes."
      >
        <Linha rotulo="Endereço" valor={ficha.endereco} />
        <Linha
          rotulo="Horário de funcionamento"
          valor={ficha.horarioDeFuncionamento}
        />
      </Bloco>
    </div>
  );
}

function Bloco({
  titulo,
  explicacao,
  children,
}: {
  titulo: string;
  explicacao?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
      <h2 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
        <span className="h-4 w-1 rounded-full bg-herval-verde" />
        {titulo}
      </h2>
      {explicacao && (
        <p className="mt-3 text-xs font-medium text-black/55">{explicacao}</p>
      )}
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

/**
 * Uma linha de valor único.
 *
 * `opcoes` existe só para mostrar, embaixo, a lista fechada de onde o valor sai.
 * É o que evita a pergunta "o que mais eu poderia ter escolhido aqui?" numa tela
 * que ainda não tem o seletor funcionando.
 */
function Linha({
  rotulo,
  valor,
  opcoes,
}: {
  rotulo: string;
  valor: string | null;
  opcoes?: readonly string[];
}) {
  const preenchido = valor !== null && valor !== "";

  return (
    <div>
      <span className={rotuloBase}>{rotulo}</span>
      <p
        className={
          preenchido
            ? "text-sm font-medium text-black/75"
            : "text-sm font-medium text-black/45"
        }
      >
        {preenchido ? valor : NAO_CADASTRADO}
      </p>
      {opcoes && (
        <p className="mt-1.5 text-xs font-medium text-black/40">
          Opções: {opcoes.join(" · ")}
        </p>
      )}
    </div>
  );
}

function Paragrafo({
  rotulo,
  valor,
  vazio = NAO_CADASTRADO,
  observacao,
}: {
  rotulo: string;
  valor: string;
  vazio?: string;
  observacao?: string;
}) {
  return (
    <div>
      <span className={rotuloBase}>{rotulo}</span>
      {valor === "" ? (
        <p className="text-sm font-medium text-black/45">{vazio}</p>
      ) : (
        // `whitespace-pre-line` porque é texto que alguém escreveu em linhas, e
        // juntar tudo num parágrafo só muda o que a pessoa escreveu.
        <p className="whitespace-pre-line text-sm font-medium text-black/75">
          {valor}
        </p>
      )}
      {observacao && (
        <p className="mt-1.5 text-xs font-medium text-black/50">{observacao}</p>
      )}
    </div>
  );
}

/**
 * Uma lista fechada com o que está marcado.
 *
 * Mostra as opções não marcadas também, apagadas. Numa tela de leitura isso
 * importa: "aceita Pix" responde menos que "aceita Pix, e não aceita boleto".
 */
function ListaMarcada({
  rotulo,
  marcados,
  todas,
}: {
  rotulo: string;
  marcados: readonly string[];
  todas: readonly string[];
}) {
  return (
    <div>
      <span className={rotuloBase}>{rotulo}</span>
      {marcados.length === 0 ? (
        <p className="text-sm font-medium text-black/45">{NAO_CADASTRADO}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {todas.map((opcao) => {
            const marcado = marcados.includes(opcao);
            return (
              <span
                key={opcao}
                className={[
                  "rounded-full px-3 py-1 text-xs font-bold",
                  marcado
                    ? "bg-herval-verde/15 text-herval-preto"
                    : "bg-black/[0.04] text-black/35 line-through",
                ].join(" ")}
              >
                {opcao}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/*
  Nulo não vira "não": são coisas diferentes. "Não" é alguém ter respondido que
  não; nulo é ninguém ter respondido. A Helô trata os dois de modo diferente, e a
  tela tem de mostrar a mesma diferença.
*/
function simOuNao(valor: boolean | null): string | null {
  if (valor === null) return null;
  return valor ? "sim" : "não";
}

function faixaEtaria(ficha: FichaDaEstrategia): string | null {
  const { faixaEtariaDe: de, faixaEtariaAte: ate } = ficha;
  if (de !== null && ate !== null) return `de ${de} a ${ate} anos`;
  if (de !== null) return `a partir de ${de} anos`;
  if (ate !== null) return `até ${ate} anos`;
  return null;
}
