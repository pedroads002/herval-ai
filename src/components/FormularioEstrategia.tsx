"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  ChevronRight,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  CLASSES_ECONOMICAS,
  FORMAS_DE_PAGAMENTO,
  IDADE_MAXIMA,
  IDADE_MINIMA,
  OBJETIVOS_DE_ATENDIMENTO,
  PARCELAMENTO_MAXIMO,
  POLITICAS_DE_VALORES,
  PRIORIDADES_COMERCIAIS,
  QUANDO_A_AVALIACAO_E_COBRADA,
  TIPOS_DE_AVALIACAO,
  type BlocoDaEstrategia,
  type ClasseEconomica,
  type ClienteDoSeletor,
  type ConvenioDaFicha,
  type FichaDaEstrategia,
  type FormaDePagamento,
  type ObjetivoDeAtendimento,
  type PoliticaDeValores,
  type PrioridadeComercial,
  type ProcedimentoDoCatalogo,
  type QuandoCobrada,
  type TipoDeAvaliacao,
} from "@/lib/dados/fichaDaEstrategia";
import {
  conferirCompletude,
  type Completude,
} from "@/lib/dados/completudeDaEstrategia";
import {
  consequenciaDaFaixaEtaria,
  consequenciaDaGratuidade,
  consequenciaDaHistoria,
  consequenciaDaPoliticaDeValores,
  consequenciaDaPrioridade,
  consequenciaDasClasses,
  consequenciaDasDores,
  consequenciaDasFormasDePagamento,
  consequenciaDasInformacoesAEvitar,
  consequenciaDasObservacoes,
  consequenciaDeQuandoCobrada,
  consequenciaDeTerAvaliacao,
  consequenciaDoAbatimento,
  consequenciaDoObjetivo,
  consequenciaDoParcelamento,
  consequenciaDoTipoDeAvaliacao,
  consequenciaDoTom,
  consequenciaDosConvenios,
  consequenciaDosDiferenciais,
  resumoDaEstrategia,
} from "@/lib/dados/consequenciasDaEstrategia";
import { salvarEstrategia } from "@/lib/acoes/estrategia";
import { RESULTADO_INICIAL } from "@/lib/acoes/resultadoDoCadastro";
import {
  Aviso,
  botaoPrincipal,
  botaoSecundario,
  campoBase,
  useQuandoDerCerto,
} from "@/components/cadastro/comuns";

/**
 * A tela da Estratégia do Cliente.
 *
 * Ela grava. Cada um dos cinco blocos abre, edita e salva sozinho, e o que vai
 * para o banco é só o bloco enviado — quem garante isso é
 * `acoes/estrategiaDoFormulario.ts`, pelo campo escondido `bloco`.
 *
 * Por que cartão fechado que abre ao clicar, e não o formulário inteiro sempre
 * aberto: são vinte campos. Aberto de uma vez, ninguém lê nada e todo mundo rola
 * — e um botão "salvar" no fim de vinte campos é um botão que ninguém sabe o que
 * está salvando. Fechado, a tela responde primeiro a pergunta "como está hoje" e
 * só depois a "o que eu quero mudar".
 *
 * As abas separam quem pergunta o quê: Atendimento é o que a Helô persegue,
 * Comercial é como o cliente recebe e com quem quer falar, Comunicação é como
 * ela fala. Público-alvo mora em Comercial, e não em Comunicação, porque classe
 * e faixa etária são com quem este cliente quer vender — o tom que sai disso é
 * que mora em Comunicação.
 *
 * Os tipos vêm de `fichaDaEstrategia.ts`, nunca de `estrategiaDoCliente.ts`:
 * importar do módulo de leitura arrastaria o cliente do Supabase para o pacote
 * do navegador.
 *
 * Campo em branco não aparece como espaço vazio. Ele diz "Falta preencher", e
 * embaixo diz o que a Helô faz enquanto estiver assim — que é o mesmo que ela
 * faz de verdade, texto fixo tirado do prompt dela, nunca uma frase gerada na
 * hora por IA.
 */

const rotuloBase = "mb-2 block text-sm font-bold text-herval-preto";

const FALTA_PREENCHER = "Falta preencher";

const ABAS = [
  { chave: "visao", rotulo: "Visão Geral" },
  { chave: "atendimento", rotulo: "Atendimento" },
  { chave: "comercial", rotulo: "Comercial" },
  { chave: "comunicacao", rotulo: "Comunicação" },
] as const;

type Aba = (typeof ABAS)[number]["chave"];

/** Em qual aba cada bloco mora. É o que faz "Editar estratégia" abrir na aba certa. */
const ABA_DO_BLOCO: Record<BlocoDaEstrategia, Aba> = {
  objetivo: "atendimento",
  avaliacao: "atendimento",
  comercial: "comercial",
  publico: "comercial",
  comunicacao: "comunicacao",
};

export default function FormularioEstrategia({
  clientes,
  ficha,
  procedimentos,
  falha,
  detalheTecnico,
}: {
  clientes: ClienteDoSeletor[];
  ficha: FichaDaEstrategia | null;
  procedimentos: ProcedimentoDoCatalogo[];
  falha: string | null;
  detalheTecnico: string | null;
}) {
  const router = useRouter();
  const [trocando, iniciarTroca] = useTransition();

  // Falha de leitura não é cliente sem estratégia. Sem esta distinção, sistema
  // fora do ar e ficha realmente em branco viram a mesma tela — e a primeira é
  // defeito, que alguém leria como "este cliente não tem estratégia".
  if (falha) {
    return (
      <div className="rounded-card border border-herval-vermelho/30 bg-herval-vermelho/5 px-5 py-6">
        <p className="text-sm font-bold text-herval-preto">{falha}</p>
        {detalheTecnico && (
          <p className="mt-2 text-xs font-medium text-black/45">
            Detalhe técnico: {detalheTecnico}
          </p>
        )}
      </div>
    );
  }

  if (ficha === null) {
    return (
      <section className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
        <p className="text-sm font-medium text-black/55">
          Nenhum cliente cadastrado ainda.
        </p>
        <p className="mt-2 text-xs font-medium text-black/45">
          A estratégia é de um cliente: ela aparece aqui assim que existir um em
          Clientes.
        </p>
      </section>
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
    <div className="max-w-5xl space-y-8">
      {/*
        O cliente está no cabeçalho da tela, e não num cartão próprio.
        Enquanto era cartão, "de quem é esta estratégia" ocupava o mesmo peso
        visual que uma configuração — e não é configuração nenhuma, é o contexto
        de tudo o que vem abaixo.
      */}
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-black/10 pb-6">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-black/40">
            Estratégia de
          </p>
          <h2 className="mt-1 truncate text-2xl font-extrabold tracking-tight text-herval-preto">
            {ficha.nome}
          </h2>
        </div>

        <div className="w-full sm:w-80">
          <label
            className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-black/40"
            htmlFor="cliente-da-estrategia"
          >
            Trocar de cliente
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
        </div>
      </div>

      {/*
        A chave zera as abas e fecha qualquer cartão em edição quando o cliente
        muda. Sem ela, quem estivesse com o bloco comercial aberto passaria a
        editar o cliente seguinte com os campos do anterior na tela.
      */}
      <Conteudo
        key={ficha.clienteId}
        ficha={ficha}
        procedimentos={procedimentos}
      />
    </div>
  );
}

function Conteudo({
  ficha,
  procedimentos,
}: {
  ficha: FichaDaEstrategia;
  procedimentos: ProcedimentoDoCatalogo[];
}) {
  const [aba, setAba] = useState<Aba>("visao");

  /*
    Um bloco aberto por vez. Dois abertos juntos deixariam duas edições não
    salvas na tela ao mesmo tempo, e aí "cancelar" num deles ficaria ambíguo.
  */
  const [blocoAberto, setBlocoAberto] = useState<BlocoDaEstrategia | null>(
    null,
  );

  const completude = conferirCompletude(ficha);

  function abrir(bloco: BlocoDaEstrategia) {
    setAba(ABA_DO_BLOCO[bloco]);
    setBlocoAberto(bloco);
  }

  const comum = {
    ficha,
    blocoAberto,
    aoEditar: abrir,
    aoFechar: () => setBlocoAberto(null),
  };

  return (
    <>
      <nav
        aria-label="Partes da estratégia"
        className="flex flex-wrap gap-1.5 rounded-controle bg-black/[0.04] p-1.5"
      >
        {ABAS.map(({ chave, rotulo: titulo }) => {
          const ativa = aba === chave;
          return (
            <button
              key={chave}
              type="button"
              aria-current={ativa ? "page" : undefined}
              onClick={() => setAba(chave)}
              className={[
                "rounded-controle px-4 py-2.5 text-sm transition-colors",
                ativa
                  ? "bg-herval-branco font-extrabold text-herval-preto shadow-card"
                  : "font-bold text-black/50 hover:text-herval-preto",
              ].join(" ")}
            >
              {titulo}
            </button>
          );
        })}
      </nav>

      {aba === "visao" && (
        <VisaoGeral
          ficha={ficha}
          completude={completude}
          aoEditar={() =>
            abrir(completude.primeiroBlocoIncompleto ?? "objetivo")
          }
        />
      )}

      {aba === "atendimento" && (
        <div className="space-y-6">
          <BlocoObjetivo {...comum} />
          <BlocoAvaliacao {...comum} />
        </div>
      )}

      {aba === "comercial" && (
        <div className="space-y-6">
          <BlocoComercial {...comum} procedimentos={procedimentos} />
          <BlocoPublico {...comum} />
        </div>
      )}

      {aba === "comunicacao" && (
        <div className="space-y-6">
          <BlocoComunicacao {...comum} />
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Aba Visão Geral                                                            */
/* -------------------------------------------------------------------------- */

function VisaoGeral({
  ficha,
  completude,
  aoEditar,
}: {
  ficha: FichaDaEstrategia;
  completude: Completude;
  aoEditar: () => void;
}) {
  const faltando = completude.itens.filter((item) => !item.preenchido);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-6">
        <section className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
          <h3 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
            <span className="h-4 w-1 rounded-full bg-herval-verde" />O que esta
            estratégia faz a Helô fazer
          </h3>

          <dl className="mt-6 space-y-5">
            {resumoDaEstrategia(ficha).map(({ rotulo: titulo, frase }) => (
              <div key={titulo}>
                <dt className="text-sm font-bold text-herval-preto">
                  {titulo}
                </dt>
                <dd className="mt-1 text-sm font-medium text-black/65">
                  {frase}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
                <span className="h-4 w-1 rounded-full bg-herval-verde" />
                Quanto já está preenchido
              </h3>
              <p className="mt-3 text-sm font-medium text-black/65">
                {completude.preenchidas} de {completude.total} configurações
                preenchidas.
              </p>
            </div>
            <button type="button" onClick={aoEditar} className={botaoPrincipal}>
              <Pencil className="h-4 w-4" />
              {faltando.length === 0
                ? "Editar estratégia"
                : "Preencher o resto"}
            </button>
          </div>

          {/* A barra é só desenho: quem conta é a frase acima dela. */}
          <div
            aria-hidden
            className="mt-6 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]"
          >
            <div
              className="h-full rounded-full bg-herval-verde transition-all"
              style={{ width: `${completude.porcento}%` }}
            />
          </div>

          {faltando.length === 0 ? (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-herval-verde/15 px-3.5 py-2 text-xs font-bold text-herval-preto">
              <Check className="h-3.5 w-3.5" />
              Nada em branco. A Helô não precisa confirmar nada com a equipe por
              falta de cadastro.
            </p>
          ) : (
            <>
              <p className="mt-6 text-xs font-bold uppercase tracking-wide text-black/40">
                O que ainda falta
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {faltando.map((item) => (
                  <li
                    key={item.rotulo}
                    className="rounded-full bg-black/[0.04] px-3 py-1.5 text-xs font-bold text-black/55"
                  >
                    {item.rotulo}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs font-medium text-black/45">
                Nada aqui é obrigatório. Cada um em branco é uma coisa que a
                Helô vai dizer que confirma com a equipe em vez de responder na
                hora.
              </p>
            </>
          )}
        </section>
      </div>

      {/*
        Endereço e horário são da ficha de Clientes, e é lá que se mudam. Viraram
        caixa de contexto ao lado, e não um bloco do mesmo tamanho dos outros,
        porque não são configuração desta tela: estão aqui só para quem escreve a
        estratégia ver o que a Helô diria se perguntassem onde é e que horas abre.
      */}
      <aside className="h-fit rounded-card border border-black/10 bg-black/[0.02] p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-black/40">
          Do cadastro de Clientes
        </p>

        <div className="mt-5 space-y-5">
          <ContextoLateral
            Icone={MapPin}
            rotulo="Endereço"
            valor={ficha.endereco}
          />
          <ContextoLateral
            Icone={CalendarClock}
            rotulo="Horário de funcionamento"
            valor={ficha.horarioDeFuncionamento}
          />
        </div>

        <p className="mt-6 text-xs font-medium text-black/45">
          Só exibição. Para mudar qualquer um dos dois, é na ficha deste cliente
          em Clientes.
        </p>
      </aside>
    </div>
  );
}

function ContextoLateral({
  Icone,
  rotulo: titulo,
  valor,
}: {
  Icone: typeof MapPin;
  rotulo: string;
  valor: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black/35" />
      <div className="min-w-0">
        <p className="text-xs font-bold text-herval-preto">{titulo}</p>
        <p
          className={
            valor === ""
              ? "mt-0.5 text-xs font-medium text-black/40"
              : "mt-0.5 text-xs font-medium text-black/65"
          }
        >
          {valor === "" ? "Não cadastrado em Clientes" : valor}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* A casca de um bloco: resumo fechado, formulário aberto                     */
/* -------------------------------------------------------------------------- */

type PropsDoBloco = {
  ficha: FichaDaEstrategia;
  blocoAberto: BlocoDaEstrategia | null;
  aoEditar: (bloco: BlocoDaEstrategia) => void;
  aoFechar: () => void;
};

function Cartao({
  bloco,
  titulo,
  explicacao,
  blocoAberto,
  aoEditar,
  aoFechar,
  resumo,
  formulario,
}: {
  bloco: BlocoDaEstrategia;
  titulo: string;
  explicacao: string;
  blocoAberto: BlocoDaEstrategia | null;
  aoEditar: (bloco: BlocoDaEstrategia) => void;
  aoFechar: () => void;
  resumo: React.ReactNode;
  formulario: React.ReactNode;
}) {
  const editando = blocoAberto === bloco;
  /*
    Com um bloco aberto, os outros não oferecem "Editar". Oferecer abriria o
    segundo e fecharia o primeiro sem avisar, levando embora o que estava
    digitado nele.
  */
  const travado = blocoAberto !== null && !editando;

  return (
    <section className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
            <span className="h-4 w-1 rounded-full bg-herval-verde" />
            {titulo}
          </h3>
          <p className="mt-3 text-xs font-medium text-black/55">{explicacao}</p>
        </div>

        {editando ? (
          <button
            type="button"
            onClick={aoFechar}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </button>
        ) : (
          <button
            type="button"
            disabled={travado}
            onClick={() => aoEditar(bloco)}
            title={
              travado
                ? "Termine ou cancele a edição aberta primeiro."
                : undefined
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-black/15 px-4 py-2 text-xs font-bold text-black/70 transition-colors hover:border-black/30 hover:text-herval-preto disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        )}
      </div>

      <div className="mt-7">{editando ? formulario : resumo}</div>
    </section>
  );
}

/**
 * A moldura de todo formulário de bloco: os dois campos escondidos que a
 * gravação exige, o botão de salvar e o aviso do resultado.
 *
 * O `bloco` escondido não é enfeite — é ele que diz à ação quais colunas este
 * envio pode tocar. Sem ele, salvar um cartão apagaria os outros quatro.
 */
function FormularioDoBloco({
  bloco,
  clienteId,
  aoSalvar,
  children,
}: {
  bloco: BlocoDaEstrategia;
  clienteId: number;
  aoSalvar: () => void;
  children: React.ReactNode;
}) {
  const [estado, executar, enviando] = useActionState(
    salvarEstrategia,
    RESULTADO_INICIAL,
  );

  useQuandoDerCerto(estado, aoSalvar);

  return (
    <form action={executar} className="space-y-7">
      <input type="hidden" name="cliente" value={clienteId} />
      <input type="hidden" name="bloco" value={bloco} />

      {children}

      <div className="flex flex-wrap items-center gap-4 border-t border-black/10 pt-6">
        <button type="submit" disabled={enviando} className={botaoPrincipal}>
          <Save className="h-4 w-4" />
          {enviando ? "Salvando…" : "Salvar"}
        </button>
        <Aviso estado={estado} />
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* 1 — Objetivo do Atendimento                                                */
/* -------------------------------------------------------------------------- */

function BlocoObjetivo({
  ficha,
  blocoAberto,
  aoEditar,
  aoFechar,
}: PropsDoBloco) {
  return (
    <Cartao
      bloco="objetivo"
      titulo="Objetivo do Atendimento"
      explicacao="Para onde a Helô conduz a conversa. É a configuração com mais consequência da tela: tudo o mais afina o jeito, isto define o destino."
      blocoAberto={blocoAberto}
      aoEditar={aoEditar}
      aoFechar={aoFechar}
      resumo={
        <div className="space-y-6">
          <Linha
            rotulo="Objetivo principal"
            valor={ficha.objetivo}
            consequencia={consequenciaDoObjetivo(ficha.objetivo)}
          />
          <Linha
            rotulo="Prioridade comercial"
            valor={ficha.prioridade}
            consequencia={consequenciaDaPrioridade(ficha.prioridade)}
          />
        </div>
      }
      formulario={<FormObjetivo ficha={ficha} aoFechar={aoFechar} />}
    />
  );
}

/*
  O estado de cada formulário mora no próprio formulário, e não no cartão que o
  contém. É o que faz "Cancelar" cancelar de verdade: o cartão só desenha o
  formulário enquanto está em edição, então fechá-lo o desmonta, e a próxima
  abertura nasce do que está salvo — não do que alguém digitou e desistiu.
*/
function FormObjetivo({
  ficha,
  aoFechar,
}: {
  ficha: FichaDaEstrategia;
  aoFechar: () => void;
}) {
  const [objetivo, setObjetivo] = useState<ObjetivoDeAtendimento | "">(
    ficha.objetivo ?? "",
  );
  const [prioridade, setPrioridade] = useState<PrioridadeComercial | "">(
    ficha.prioridade ?? "",
  );

  return (
    <FormularioDoBloco
      bloco="objetivo"
      clienteId={ficha.clienteId}
      aoSalvar={aoFechar}
    >
      <Escolha
        nome="objetivo_atendimento"
        rotulo="Objetivo principal"
        opcoes={OBJETIVOS_DE_ATENDIMENTO}
        valor={objetivo}
        aoMudar={setObjetivo}
        consequencia={consequenciaDoObjetivo(objetivo || null)}
      />
      <Escolha
        nome="prioridade_comercial"
        rotulo="Prioridade comercial"
        opcoes={PRIORIDADES_COMERCIAIS}
        valor={prioridade}
        aoMudar={setPrioridade}
        consequencia={consequenciaDaPrioridade(prioridade || null)}
      />
    </FormularioDoBloco>
  );
}

/* -------------------------------------------------------------------------- */
/* 2 — Avaliação / Consulta                                                   */
/* -------------------------------------------------------------------------- */

function BlocoAvaliacao({
  ficha,
  blocoAberto,
  aoEditar,
  aoFechar,
}: PropsDoBloco) {
  return (
    <Cartao
      bloco="avaliacao"
      titulo="Avaliação / Consulta"
      explicacao="O que vem antes do procedimento. São regras, não preço: nenhum campo aqui guarda valor, e nenhuma combinação deles autoriza a Helô a dizer um número."
      blocoAberto={blocoAberto}
      aoEditar={aoEditar}
      aoFechar={aoFechar}
      resumo={
        <div className="space-y-6">
          <Linha
            rotulo="Tem avaliação inicial"
            valor={simOuNao(ficha.temAvaliacaoInicial)}
            consequencia={consequenciaDeTerAvaliacao(ficha.temAvaliacaoInicial)}
          />
          {ficha.temAvaliacaoInicial !== false && (
            <>
              <Linha
                rotulo="Tipo"
                valor={ficha.tipoDeAvaliacao}
                consequencia={consequenciaDoTipoDeAvaliacao(
                  ficha.tipoDeAvaliacao,
                )}
              />
              <Linha
                rotulo="É gratuita"
                valor={simOuNao(ficha.avaliacaoGratuita)}
                consequencia={consequenciaDaGratuidade(ficha.avaliacaoGratuita)}
              />
              {ficha.avaliacaoGratuita !== true && (
                <>
                  <Linha
                    rotulo="Quando é cobrada"
                    valor={ficha.quandoCobrada}
                    consequencia={consequenciaDeQuandoCobrada(
                      ficha.quandoCobrada,
                    )}
                  />
                  <Linha
                    rotulo="O que for pago abate no procedimento"
                    valor={simOuNao(ficha.avaliacaoAbateNoProcedimento)}
                    consequencia={consequenciaDoAbatimento(
                      ficha.avaliacaoAbateNoProcedimento,
                    )}
                  />
                </>
              )}
            </>
          )}
          <Linha
            rotulo="A Helô pode falar de valor"
            valor={simOuNao(ficha.heloPodeInformarValor)}
            consequencia={consequenciaDaPoliticaDeValores(
              ficha.politicaDeValores,
              ficha.heloPodeInformarValor,
            )}
          />
        </div>
      }
      formulario={<FormAvaliacao ficha={ficha} aoFechar={aoFechar} />}
    />
  );
}

function FormAvaliacao({
  ficha,
  aoFechar,
}: {
  ficha: FichaDaEstrategia;
  aoFechar: () => void;
}) {
  const [tem, setTem] = useState<Tri>(deSimOuNao(ficha.temAvaliacaoInicial));
  const [tipo, setTipo] = useState<TipoDeAvaliacao | "">(
    ficha.tipoDeAvaliacao ?? "",
  );
  const [gratuita, setGratuita] = useState<Tri>(
    deSimOuNao(ficha.avaliacaoGratuita),
  );
  const [quando, setQuando] = useState<QuandoCobrada | "">(
    ficha.quandoCobrada ?? "",
  );
  const [abate, setAbate] = useState<Tri>(
    deSimOuNao(ficha.avaliacaoAbateNoProcedimento),
  );
  const [podeFalar, setPodeFalar] = useState<Tri>(
    deSimOuNao(ficha.heloPodeInformarValor),
  );

  /*
    Quem respondeu que não tem avaliação não é perguntado sobre o tipo nem sobre
    a cobrança dela. Quem respondeu que é gratuita não é perguntado quando ela é
    cobrada. Esses campos não são só escondidos: a gravação os zera, porque
    "não tem avaliação" junto de "tipo: Presencial" faria a Helô falar de uma
    avaliação presencial que este cliente não oferece.
  */
  const temAvaliacao = tem !== "nao";
  const ehCobrada = temAvaliacao && gratuita !== "sim";

  return (
    <FormularioDoBloco
      bloco="avaliacao"
      clienteId={ficha.clienteId}
      aoSalvar={aoFechar}
    >
      <Tristado
        nome="tem_avaliacao_inicial"
        rotulo="Tem avaliação inicial antes do procedimento"
        valor={tem}
        aoMudar={setTem}
        consequencia={consequenciaDeTerAvaliacao(paraSimOuNao(tem))}
      />

      {temAvaliacao ? (
        <>
          <Escolha
            nome="tipo_avaliacao"
            rotulo="Tipo de avaliação"
            opcoes={TIPOS_DE_AVALIACAO}
            valor={tipo}
            aoMudar={setTipo}
            consequencia={consequenciaDoTipoDeAvaliacao(tipo || null)}
          />
          <Tristado
            nome="avaliacao_gratuita"
            rotulo="A avaliação é gratuita"
            valor={gratuita}
            aoMudar={setGratuita}
            consequencia={consequenciaDaGratuidade(paraSimOuNao(gratuita))}
          />
        </>
      ) : (
        <p className="rounded-controle bg-black/[0.04] px-4 py-3 text-xs font-medium text-black/60">
          Com &ldquo;não&rdquo; aqui, tipo, gratuidade, cobrança e abatimento
          deixam de valer — ao salvar, os quatro são limpos para a Helô não
          falar de uma avaliação que este cliente não oferece.
        </p>
      )}

      {ehCobrada && (
        <>
          <Escolha
            nome="avaliacao_quando_cobrada"
            rotulo="Quando a avaliação é cobrada"
            opcoes={QUANDO_A_AVALIACAO_E_COBRADA}
            valor={quando}
            aoMudar={setQuando}
            consequencia={consequenciaDeQuandoCobrada(quando || null)}
          />
          <Tristado
            nome="avaliacao_abate_procedimento"
            rotulo="O que for pago na avaliação abate no procedimento"
            valor={abate}
            aoMudar={setAbate}
            consequencia={consequenciaDoAbatimento(paraSimOuNao(abate))}
          />
        </>
      )}

      <Tristado
        nome="helo_pode_informar_valor"
        rotulo="A Helô pode falar de valor com o paciente"
        valor={podeFalar}
        aoMudar={setPodeFalar}
        consequencia={consequenciaDaPoliticaDeValores(
          ficha.politicaDeValores,
          paraSimOuNao(podeFalar),
        )}
      />
      <p className="text-xs font-medium text-black/45">
        Mesmo em &ldquo;sim&rdquo;, a Helô não diz número: ela confirma com a
        equipe. Esta chave só decide se ela entra no assunto.
      </p>
    </FormularioDoBloco>
  );
}

/* -------------------------------------------------------------------------- */
/* 3 — Condições Comerciais                                                   */
/* -------------------------------------------------------------------------- */

function BlocoComercial({
  ficha,
  blocoAberto,
  aoEditar,
  aoFechar,
  procedimentos,
}: PropsDoBloco & { procedimentos: ProcedimentoDoCatalogo[] }) {
  const nomesPorId = new Map(procedimentos.map((p) => [p.id, p.nome]));

  return (
    <Cartao
      bloco="comercial"
      titulo="Condições Comerciais"
      explicacao="Como o cliente recebe. O número exato de qualquer coisa continua vindo da equipe — a Helô confirma, não cota."
      blocoAberto={blocoAberto}
      aoEditar={aoEditar}
      aoFechar={aoFechar}
      resumo={
        <div className="space-y-6">
          <ListaMarcada
            rotulo="Formas de pagamento"
            marcados={ficha.formasDePagamento}
            todas={FORMAS_DE_PAGAMENTO}
            consequencia={consequenciaDasFormasDePagamento(
              ficha.formasDePagamento,
            )}
          />
          <Linha
            rotulo="Parcelamento máximo"
            valor={
              ficha.parcelamentoMaximo === null
                ? null
                : `em até ${ficha.parcelamentoMaximo}x`
            }
            consequencia={consequenciaDoParcelamento(ficha.parcelamentoMaximo)}
          />

          <div>
            <span className={rotuloBase}>Convênios</span>
            {ficha.convenios.length === 0 ? (
              <p className="text-sm font-medium text-black/45">
                {FALTA_PREENCHER}
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
                      ? "nenhum procedimento marcado"
                      : convenio.especialidadeIds
                          .map(
                            (id) =>
                              nomesPorId.get(id) ?? "procedimento removido",
                          )
                          .join(", ")}
                  </li>
                ))}
              </ul>
            )}
            <Consequencia
              texto={consequenciaDosConvenios(ficha.convenios.length)}
            />
          </div>

          <Linha
            rotulo="Política de valores"
            valor={ficha.politicaDeValores}
            consequencia={consequenciaDaPoliticaDeValores(
              ficha.politicaDeValores,
              ficha.heloPodeInformarValor,
            )}
          />
        </div>
      }
      formulario={
        <FormComercial
          ficha={ficha}
          aoFechar={aoFechar}
          procedimentos={procedimentos}
        />
      }
    />
  );
}

function FormComercial({
  ficha,
  aoFechar,
  procedimentos,
}: {
  ficha: FichaDaEstrategia;
  aoFechar: () => void;
  procedimentos: ProcedimentoDoCatalogo[];
}) {
  const [formas, setFormas] = useState<FormaDePagamento[]>([
    ...ficha.formasDePagamento,
  ]);
  const [parcelamento, setParcelamento] = useState(
    ficha.parcelamentoMaximo === null ? "" : String(ficha.parcelamentoMaximo),
  );
  const [politica, setPolitica] = useState<PoliticaDeValores | "">(
    ficha.politicaDeValores ?? "",
  );
  const [convenios, setConvenios] = useState<ConvenioDaFicha[]>(
    ficha.convenios.map((convenio) => ({
      nome: convenio.nome,
      especialidadeIds: [...convenio.especialidadeIds],
    })),
  );

  return (
    <FormularioDoBloco
      bloco="comercial"
      clienteId={ficha.clienteId}
      aoSalvar={aoFechar}
    >
      <Marcadores
        nome="formas_pagamento"
        rotulo="Formas de pagamento"
        todas={FORMAS_DE_PAGAMENTO}
        marcados={formas}
        aoMudar={setFormas}
        consequencia={consequenciaDasFormasDePagamento(formas)}
      />

      <div>
        <label className={rotuloBase} htmlFor="campo-parcelamento">
          Parcelamento máximo (em vezes)
        </label>
        <input
          id="campo-parcelamento"
          name="parcelamento"
          type="number"
          inputMode="numeric"
          min={1}
          max={PARCELAMENTO_MAXIMO}
          placeholder="Ex.: 12"
          value={parcelamento}
          onChange={(e) => {
            /*
              Só aceita o que a gravação aceitaria: vazio, ou um inteiro de 1
              a PARCELAMENTO_MAXIMO. Quem digitar "30" para no "3" — a tecla
              que passaria do limite é ignorada, e o campo nunca mostra um
              número que o banco vai recusar. Recusar a tecla, e não corrigir
              depois, é o que evita a prévia prometer "até 30x".
            */
            const texto = e.target.value;
            if (texto === "") {
              setParcelamento("");
              return;
            }
            if (!/^\d+$/.test(texto)) return;
            const numero = Number(texto);
            if (numero < 1 || numero > PARCELAMENTO_MAXIMO) return;
            setParcelamento(texto);
          }}
          className={`${campoBase} max-w-40`}
        />
        <Consequencia
          texto={consequenciaDoParcelamento(
            parcelamento === "" ? null : Number(parcelamento),
          )}
        />
        <p className="mt-2 text-xs font-medium text-black/45">
          Quantas vezes, não quanto. Até {PARCELAMENTO_MAXIMO}x.
        </p>
      </div>

      <EditorDeConvenios
        convenios={convenios}
        aoMudar={setConvenios}
        procedimentos={procedimentos}
      />

      <Escolha
        nome="politica_de_valores"
        rotulo="Política de valores"
        opcoes={POLITICAS_DE_VALORES}
        valor={politica}
        aoMudar={setPolitica}
        consequencia={consequenciaDaPoliticaDeValores(
          politica || null,
          ficha.heloPodeInformarValor,
        )}
      />
    </FormularioDoBloco>
  );
}

/**
 * Os convênios, em linhas que se adicionam e se removem.
 *
 * A numeração dos campos (`convenio-0-nome`, `convenio-1-nome`, …) é o que a
 * leitura do formulário varre. Remover uma linha renumera as de baixo, e isso
 * não é problema: o que vai para o banco é o que está na tela no momento do
 * envio, não a posição que cada convênio tinha antes.
 *
 * Procedimento pausado não aparece para marcar — oferecê-lo seria convidar a
 * cobrir no convênio algo que a Helô tem ordem de não oferecer. Mas se um
 * convênio já o tinha marcado, ele continua ali, avisado: apagar por conta
 * própria seria mexer num cadastro que ninguém pediu para mexer.
 */
function EditorDeConvenios({
  convenios,
  aoMudar,
  procedimentos,
}: {
  convenios: ConvenioDaFicha[];
  aoMudar: (convenios: ConvenioDaFicha[]) => void;
  procedimentos: ProcedimentoDoCatalogo[];
}) {
  function mudarUm(indice: number, mudanca: Partial<ConvenioDaFicha>) {
    aoMudar(
      convenios.map((convenio, i) =>
        i === indice ? { ...convenio, ...mudanca } : convenio,
      ),
    );
  }

  return (
    <fieldset>
      <legend className={rotuloBase}>Convênios aceitos</legend>

      {convenios.length === 0 ? (
        <p className="text-sm font-medium text-black/45">
          Nenhum convênio cadastrado.
        </p>
      ) : (
        <div className="space-y-4">
          {convenios.map((convenio, indice) => {
            const ofertados = procedimentos.filter(
              (p) => p.ativa || convenio.especialidadeIds.includes(p.id),
            );

            return (
              <div
                key={indice}
                className="rounded-card border border-black/10 px-5 py-4"
              >
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-0 flex-1">
                    <label
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-black/50"
                      htmlFor={`convenio-${indice}-nome`}
                    >
                      Nome do convênio
                    </label>
                    <input
                      id={`convenio-${indice}-nome`}
                      name={`convenio-${indice}-nome`}
                      type="text"
                      maxLength={120}
                      autoComplete="off"
                      placeholder="Ex.: Unimed"
                      value={convenio.nome}
                      onChange={(e) =>
                        mudarUm(indice, { nome: e.target.value })
                      }
                      className={campoBase}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      aoMudar(convenios.filter((_, i) => i !== indice))
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-herval-vermelho/40 px-4 py-2.5 text-xs font-bold text-herval-vermelho transition-colors hover:bg-herval-vermelho/5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remover
                  </button>
                </div>

                <p className="mt-4 text-xs font-bold uppercase tracking-wide text-black/50">
                  Procedimentos cobertos
                </p>
                {ofertados.length === 0 ? (
                  <p className="mt-2 text-xs font-medium text-black/45">
                    Nenhum procedimento ativo no catálogo.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ofertados.map((procedimento) => (
                      <label
                        key={procedimento.id}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/15 px-3.5 py-2 text-xs font-bold text-black/70 transition-colors has-[:checked]:border-herval-verde has-[:checked]:bg-herval-verde/15 has-[:checked]:text-herval-preto"
                      >
                        <input
                          type="checkbox"
                          name={`convenio-${indice}-procedimentos`}
                          value={procedimento.id}
                          checked={convenio.especialidadeIds.includes(
                            procedimento.id,
                          )}
                          onChange={(e) =>
                            mudarUm(indice, {
                              especialidadeIds: e.target.checked
                                ? [
                                    ...convenio.especialidadeIds,
                                    procedimento.id,
                                  ]
                                : convenio.especialidadeIds.filter(
                                    (id) => id !== procedimento.id,
                                  ),
                            })
                          }
                          className="h-3.5 w-3.5 accent-herval-verde"
                        />
                        {procedimento.nome}
                        {!procedimento.ativa && " (pausado)"}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          aoMudar([...convenios, { nome: "", especialidadeIds: [] }])
        }
        className={`mt-4 ${botaoSecundario}`}
      >
        <Plus className="h-4 w-4" />
        Adicionar convênio
      </button>

      <Consequencia
        texto={consequenciaDosConvenios(
          convenios.filter((c) => c.nome.trim() !== "").length,
        )}
      />
      <p className="mt-2 text-xs font-medium text-black/45">
        Para apagar um convênio, use Remover. Linha com o nome em branco é
        descartada ao salvar.
      </p>
    </fieldset>
  );
}

/* -------------------------------------------------------------------------- */
/* 4 — Público-alvo                                                           */
/* -------------------------------------------------------------------------- */

function BlocoPublico({
  ficha,
  blocoAberto,
  aoEditar,
  aoFechar,
}: PropsDoBloco) {
  return (
    <Cartao
      bloco="publico"
      titulo="Público-alvo"
      explicacao="Com quem este cliente quer falar. Serve de tom, não de filtro: a Helô não recusa ninguém por causa disto."
      blocoAberto={blocoAberto}
      aoEditar={aoEditar}
      aoFechar={aoFechar}
      resumo={
        <div className="space-y-6">
          <ListaMarcada
            rotulo="Classe econômica"
            marcados={ficha.classes}
            todas={CLASSES_ECONOMICAS}
            consequencia={consequenciaDasClasses(ficha.classes)}
          />
          <Linha
            rotulo="Faixa etária"
            valor={faixaEtaria(ficha)}
            consequencia={consequenciaDaFaixaEtaria(
              ficha.faixaEtariaDe,
              ficha.faixaEtariaAte,
            )}
          />
          <div>
            <span className={rotuloBase}>Principais dores</span>
            {ficha.principaisDores.length === 0 ? (
              <p className="text-sm font-medium text-black/45">
                {FALTA_PREENCHER}
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
            <Consequencia
              texto={consequenciaDasDores(ficha.principaisDores.length)}
            />
          </div>
        </div>
      }
      formulario={<FormPublico ficha={ficha} aoFechar={aoFechar} />}
    />
  );
}

function FormPublico({
  ficha,
  aoFechar,
}: {
  ficha: FichaDaEstrategia;
  aoFechar: () => void;
}) {
  const [classes, setClasses] = useState<ClasseEconomica[]>([...ficha.classes]);
  const [de, setDe] = useState(
    ficha.faixaEtariaDe === null ? "" : String(ficha.faixaEtariaDe),
  );
  const [ate, setAte] = useState(
    ficha.faixaEtariaAte === null ? "" : String(ficha.faixaEtariaAte),
  );
  const [dores, setDores] = useState(ficha.principaisDores.join("\n"));

  const quantasDores = dores
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha !== "").length;

  return (
    <FormularioDoBloco
      bloco="publico"
      clienteId={ficha.clienteId}
      aoSalvar={aoFechar}
    >
      <Marcadores
        nome="classe_economica"
        rotulo="Classe econômica"
        todas={CLASSES_ECONOMICAS}
        marcados={classes}
        aoMudar={setClasses}
        consequencia={consequenciaDasClasses(classes)}
      />

      <div>
        <span className={rotuloBase}>Faixa etária</span>
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-black/50">
          <span>de</span>
          <Idade
            nome="faixa_etaria_de"
            etiqueta="Idade de início"
            valor={de}
            aoMudar={setDe}
          />
          <span>até</span>
          <Idade
            nome="faixa_etaria_ate"
            etiqueta="Idade final"
            valor={ate}
            aoMudar={setAte}
          />
          <span>anos</span>
        </div>
        <Consequencia
          texto={consequenciaDaFaixaEtaria(
            de === "" ? null : Number(de),
            ate === "" ? null : Number(ate),
          )}
        />
        <p className="mt-2 text-xs font-medium text-black/45">
          Dá para informar só uma das duas. Em branco as duas, a Helô não
          calibra por idade.
        </p>
      </div>

      <div>
        <label className={rotuloBase} htmlFor="campo-dores">
          Principais dores
        </label>
        <textarea
          id="campo-dores"
          name="principais_dores"
          rows={5}
          placeholder={"Uma por linha. Ex.:\nFlacidez no rosto\nManchas de sol"}
          value={dores}
          onChange={(e) => setDores(e.target.value)}
          className={campoBase}
        />
        <Consequencia texto={consequenciaDasDores(quantasDores)} />
        <p className="mt-2 text-xs font-medium text-black/45">
          Uma dor por linha. Linha vazia é ignorada.
        </p>
      </div>
    </FormularioDoBloco>
  );
}

/* -------------------------------------------------------------------------- */
/* 5 — Diretrizes de Comunicação                                              */
/* -------------------------------------------------------------------------- */

function BlocoComunicacao({
  ficha,
  blocoAberto,
  aoEditar,
  aoFechar,
}: PropsDoBloco) {
  return (
    <Cartao
      bloco="comunicacao"
      titulo="Diretrizes de Comunicação"
      explicacao="Como a Helô fala em nome deste cliente. Nenhum destes campos é obrigatório — mas o de informações a evitar é o único lugar da tela que vira proibição."
      blocoAberto={blocoAberto}
      aoEditar={aoEditar}
      aoFechar={aoFechar}
      resumo={
        <div className="space-y-6">
          <Linha
            rotulo="Tom predominante"
            valor={ficha.tomPredominante || null}
            consequencia={consequenciaDoTom(ficha.tomPredominante)}
          />
          <Paragrafo
            rotulo="Diferenciais"
            valor={ficha.diferenciais}
            consequencia={consequenciaDosDiferenciais(ficha.diferenciais)}
          />
          <Paragrafo
            rotulo="Informações a evitar"
            valor={ficha.informacoesAEvitar}
            opcional
            consequencia={consequenciaDasInformacoesAEvitar(
              ficha.informacoesAEvitar,
            )}
          />
          <Paragrafo
            rotulo="Observações de atendimento"
            valor={ficha.observacoesDeAtendimento}
            opcional
            consequencia={consequenciaDasObservacoes(
              ficha.observacoesDeAtendimento,
            )}
          />
          <Paragrafo
            rotulo="História"
            valor={ficha.historia}
            consequencia={consequenciaDaHistoria(ficha.historia)}
          />
        </div>
      }
      formulario={<FormComunicacao ficha={ficha} aoFechar={aoFechar} />}
    />
  );
}

function FormComunicacao({
  ficha,
  aoFechar,
}: {
  ficha: FichaDaEstrategia;
  aoFechar: () => void;
}) {
  const [tom, setTom] = useState(ficha.tomPredominante);
  const [diferenciais, setDiferenciais] = useState(ficha.diferenciais);
  const [evitar, setEvitar] = useState(ficha.informacoesAEvitar);
  const [observacoes, setObservacoes] = useState(
    ficha.observacoesDeAtendimento,
  );
  const [historia, setHistoria] = useState(ficha.historia);

  return (
    <FormularioDoBloco
      bloco="comunicacao"
      clienteId={ficha.clienteId}
      aoSalvar={aoFechar}
    >
      <div>
        <label className={rotuloBase} htmlFor="campo-tom">
          Tom predominante
        </label>
        <input
          id="campo-tom"
          name="tom_predominante"
          type="text"
          maxLength={120}
          autoComplete="off"
          placeholder="Ex.: acolhedor e direto, sem formalidade"
          value={tom}
          onChange={(e) => setTom(e.target.value)}
          className={campoBase}
        />
        <Consequencia texto={consequenciaDoTom(tom.trim())} />
      </div>

      <Texto
        nome="diferenciais"
        rotulo="Diferenciais"
        valor={diferenciais}
        aoMudar={setDiferenciais}
        limite={2000}
        exemplo="O que faz alguém escolher este cliente e não outro."
        consequencia={consequenciaDosDiferenciais(diferenciais.trim())}
      />

      <Texto
        nome="informacoes_a_evitar"
        rotulo="Informações a evitar"
        valor={evitar}
        aoMudar={setEvitar}
        limite={1000}
        exemplo="O que a Helô não pode dizer, mesmo se perguntarem."
        consequencia={consequenciaDasInformacoesAEvitar(evitar.trim())}
      />

      <Texto
        nome="observacoes_atendimento"
        rotulo="Observações de atendimento"
        valor={observacoes}
        aoMudar={setObservacoes}
        limite={1000}
        exemplo="O que não cabe nos outros campos e a Helô precisa saber."
        consequencia={consequenciaDasObservacoes(observacoes.trim())}
      />

      <Texto
        nome="historia"
        rotulo="História"
        valor={historia}
        aoMudar={setHistoria}
        limite={2000}
        exemplo="Como este cliente começou, em uma ou duas frases."
        consequencia={consequenciaDaHistoria(historia.trim())}
      />
    </FormularioDoBloco>
  );
}

/* -------------------------------------------------------------------------- */
/* Peças do resumo                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A frase do que a Helô faz com aquela configuração.
 *
 * Aparece no resumo e no formulário, e no formulário ela muda junto com a
 * escolha, antes de salvar — é a prévia de consequência. O texto é fixo,
 * escolhido por valor em `consequenciasDaEstrategia.ts`: nunca uma chamada de IA
 * para gerar a frase na hora, que faria a Helô opinar sobre si mesma.
 */
function Consequencia({ texto }: { texto: string }) {
  return (
    <p className="mt-2 flex items-start gap-2 text-xs font-medium text-black/50">
      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-herval-verde" />
      {texto}
    </p>
  );
}

function Linha({
  rotulo: titulo,
  valor,
  consequencia,
}: {
  rotulo: string;
  valor: string | null;
  consequencia: string;
}) {
  const preenchido = valor !== null && valor !== "";

  return (
    <div>
      <span className={rotuloBase}>{titulo}</span>
      <p
        className={
          preenchido
            ? "text-sm font-medium text-black/75"
            : "text-sm font-medium text-black/45"
        }
      >
        {preenchido ? valor : FALTA_PREENCHER}
      </p>
      <Consequencia texto={consequencia} />
    </div>
  );
}

function Paragrafo({
  rotulo: titulo,
  valor,
  consequencia,
  opcional,
}: {
  rotulo: string;
  valor: string;
  consequencia: string;
  opcional?: boolean;
}) {
  return (
    <div>
      <span className={rotuloBase}>{titulo}</span>
      {valor === "" ? (
        <p className="text-sm font-medium text-black/45">
          {opcional ? "Nada registrado" : FALTA_PREENCHER}
        </p>
      ) : (
        // `whitespace-pre-line` porque é texto que alguém escreveu em linhas, e
        // juntar tudo num parágrafo só muda o que a pessoa escreveu.
        <p className="whitespace-pre-line text-sm font-medium text-black/75">
          {valor}
        </p>
      )}
      <Consequencia texto={consequencia} />
    </div>
  );
}

/**
 * Uma lista fechada com o que está marcado.
 *
 * Mostra as opções não marcadas também, apagadas. Num resumo isso importa:
 * "aceita Pix" responde menos que "aceita Pix, e não aceita boleto".
 */
function ListaMarcada({
  rotulo: titulo,
  marcados,
  todas,
  consequencia,
}: {
  rotulo: string;
  marcados: readonly string[];
  todas: readonly string[];
  consequencia: string;
}) {
  return (
    <div>
      <span className={rotuloBase}>{titulo}</span>
      {marcados.length === 0 ? (
        <p className="text-sm font-medium text-black/45">{FALTA_PREENCHER}</p>
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
      <Consequencia texto={consequencia} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Peças do formulário                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Um valor de lista fechada. A primeira opção é "ainda não respondido".
 *
 * Genérico no tipo da opção para o estado da tela carregar o tipo fechado da
 * lista, e não `string`. Sem isso, cada prévia de consequência precisaria de uma
 * conversão forçada — e conversão forçada é exatamente onde um valor fora de
 * lista passaria sem ninguém notar.
 */
function Escolha<T extends string>({
  nome,
  rotulo: titulo,
  opcoes,
  valor,
  aoMudar,
  consequencia,
}: {
  nome: string;
  rotulo: string;
  opcoes: readonly T[];
  valor: T | "";
  aoMudar: (valor: T | "") => void;
  consequencia: string;
}) {
  const id = `campo-${nome}`;

  return (
    <div>
      <label className={rotuloBase} htmlFor={id}>
        {titulo}
      </label>
      <select
        id={id}
        name={nome}
        value={valor}
        onChange={(e) => aoMudar(e.target.value as T | "")}
        className={campoBase}
      >
        <option value="">Ainda não respondido</option>
        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
      </select>
      <Consequencia texto={consequencia} />
    </div>
  );
}

/**
 * Sim, não, ou ninguém respondeu.
 *
 * Três opções e não uma caixa de marcar porque nulo e falso são coisas
 * diferentes para a Helô: "não é gratuita" ela fala, "(não cadastrado)" ela vai
 * confirmar com a equipe. Uma caixa de marcar só sabe dois estados, e usaria
 * "desmarcado" para as duas coisas.
 */
function Tristado({
  nome,
  rotulo: titulo,
  valor,
  aoMudar,
  consequencia,
}: {
  nome: string;
  rotulo: string;
  valor: Tri;
  aoMudar: (valor: Tri) => void;
  consequencia: string;
}) {
  const id = `campo-${nome}`;

  return (
    <div>
      <label className={rotuloBase} htmlFor={id}>
        {titulo}
      </label>
      <select
        id={id}
        name={nome}
        value={valor}
        onChange={(e) => aoMudar(e.target.value as Tri)}
        className={`${campoBase} max-w-xs`}
      >
        <option value="">Ainda não respondido</option>
        <option value="sim">Sim</option>
        <option value="nao">Não</option>
      </select>
      <Consequencia texto={consequencia} />
    </div>
  );
}

/** As caixas marcadas de uma lista fechada de texto. */
function Marcadores<T extends string>({
  nome,
  rotulo: titulo,
  todas,
  marcados,
  aoMudar,
  consequencia,
}: {
  nome: string;
  rotulo: string;
  todas: readonly T[];
  marcados: T[];
  aoMudar: (marcados: T[]) => void;
  consequencia: string;
}) {
  return (
    <fieldset>
      <legend className={rotuloBase}>{titulo}</legend>
      <div className="flex flex-wrap gap-2">
        {todas.map((opcao) => (
          <label
            key={opcao}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/15 px-3.5 py-2 text-xs font-bold text-black/70 transition-colors has-[:checked]:border-herval-verde has-[:checked]:bg-herval-verde/15 has-[:checked]:text-herval-preto"
          >
            <input
              type="checkbox"
              name={nome}
              value={opcao}
              checked={marcados.includes(opcao)}
              onChange={(e) =>
                aoMudar(
                  e.target.checked
                    ? [...marcados, opcao]
                    : marcados.filter((item) => item !== opcao),
                )
              }
              className="h-3.5 w-3.5 accent-herval-verde"
            />
            {opcao}
          </label>
        ))}
      </div>
      <Consequencia texto={consequencia} />
    </fieldset>
  );
}

function Idade({
  nome,
  etiqueta,
  valor,
  aoMudar,
}: {
  nome: string;
  etiqueta: string;
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  return (
    <input
      type="number"
      name={nome}
      aria-label={etiqueta}
      inputMode="numeric"
      min={IDADE_MINIMA}
      max={IDADE_MAXIMA}
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      className="w-24 rounded-controle border border-black/15 bg-herval-branco px-3 py-2 text-sm font-medium text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
    />
  );
}

function Texto({
  nome,
  rotulo: titulo,
  valor,
  aoMudar,
  limite,
  exemplo,
  consequencia,
}: {
  nome: string;
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  limite: number;
  exemplo: string;
  consequencia: string;
}) {
  const id = `campo-${nome}`;

  return (
    <div>
      <label className={rotuloBase} htmlFor={id}>
        {titulo}
      </label>
      <textarea
        id={id}
        name={nome}
        rows={4}
        maxLength={limite}
        placeholder={exemplo}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className={campoBase}
      />
      <Consequencia texto={consequencia} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Conversões                                                                 */
/* -------------------------------------------------------------------------- */

/*
  Nulo não vira "não": são coisas diferentes. "Não" é alguém ter respondido que
  não; nulo é ninguém ter respondido. A Helô trata os dois de modo diferente, e a
  tela tem de mostrar a mesma diferença.
*/
function simOuNao(valor: boolean | null): string | null {
  if (valor === null) return null;
  return valor ? "sim" : "não";
}

/** Os três estados do seletor de sim/não, na grafia que vai no formulário. */
type Tri = "" | "sim" | "nao";

/** O que o seletor de três estados mostra para um valor do banco. */
function deSimOuNao(valor: boolean | null): Tri {
  if (valor === null) return "";
  return valor ? "sim" : "nao";
}

/** E o caminho de volta, para a prévia de consequência acompanhar a escolha. */
function paraSimOuNao(valor: Tri): boolean | null {
  if (valor === "sim") return true;
  if (valor === "nao") return false;
  return null;
}

function faixaEtaria(ficha: FichaDaEstrategia): string | null {
  const { faixaEtariaDe: de, faixaEtariaAte: ate } = ficha;
  if (de !== null && ate !== null) return `de ${de} a ${ate} anos`;
  if (de !== null) return `a partir de ${de} anos`;
  if (ate !== null) return `até ${ate} anos`;
  return null;
}
