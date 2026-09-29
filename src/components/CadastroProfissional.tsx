"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  Plus,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  cadastrarAutonomo,
  cadastrarCliente,
  cadastrarProfissional,
} from "@/lib/acoes/profissionais";
import { RESULTADO_INICIAL } from "@/lib/acoes/resultadoDoCadastro";
import { tiposDeProfissional } from "@/lib/dados/tiposDeProfissional";
import type { ResultadoDoCadastro } from "@/lib/acoes/resultadoDoCadastro";
import type {
  ClienteDoCadastro,
  EspecialidadeDoCadastro,
} from "@/lib/dados/profissionais";

/**
 * O cadastro da seção — **uma porta de entrada só.**
 *
 * Antes eram dois botões, "Cadastrar cliente" e "Cadastrar profissional", e
 * quem chegava tinha que saber de antemão que existe uma tabela de clínicas
 * atrás da tela e que ela precisa vir primeiro. Agora a tela pergunta o que
 * ela precisa saber — a pessoa atende sozinha ou tem equipe? — e conduz o
 * resto.
 *
 * Os dois caminhos:
 *
 *   ATENDE SOZINHO  um formulário só. O nome serve ao cliente e à pessoa, que
 *                   são a mesma. Uma gravação, um passo.
 *   TEM EQUIPE      o nome da clínica primeiro, e na sequência, sem sair da
 *                   tela, quantas pessoas atendem nela.
 *
 * O banco não mudou: continuam sendo `clinicas`, `unidades`, `profissionais` e
 * os vínculos. O que mudou é quem monta esse desenho — antes era quem cadastra,
 * agora é a tela.
 */

const campoBase =
  "w-full rounded-controle border border-black/15 bg-herval-branco px-4 py-3 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

const botaoPrincipal =
  "inline-flex items-center gap-2 rounded-full bg-herval-verde px-5 py-3 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:cursor-not-allowed disabled:opacity-50";

const botaoSecundario =
  "inline-flex items-center gap-2 rounded-full border border-black/15 px-5 py-3 text-sm font-bold text-black/70 transition-colors hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-40";

const rotulo =
  "mb-2 block text-xs font-bold uppercase tracking-wide text-black/50";

/** Um cliente já existente no banco, do jeito que o passo da equipe precisa. */
type ClienteEmFoco = {
  id: number;
  nome: string;
  unidades: { id: number; nome: string }[];
};

/**
 * Onde o fluxo está.
 *
 * É um passo de cada vez de propósito: a pergunta da entrada só tem valor se a
 * resposta levar a um caminho, e dois formulários abertos ao mesmo tempo,
 * ambos começando por um campo "nome", é o tipo de tela em que se digita o nome
 * da pessoa no lugar do nome da clínica.
 */
type Passo =
  | { etapa: "fechado" }
  | { etapa: "pergunta" }
  | { etapa: "autonomo" }
  | { etapa: "cliente" }
  | {
      etapa: "equipe";
      cliente: ClienteEmFoco;
      /** Falso quando a clínica já estava cadastrada antes deste fluxo. */
      novo: boolean;
      /** Quem já foi cadastrado nesta passagem, para a tela ir mostrando. */
      cadastrados: string[];
    };

export default function CadastroProfissional({
  clientes,
  especialidades,
}: {
  clientes: ClienteDoCadastro[];
  especialidades: EspecialidadeDoCadastro[];
}) {
  const [passo, setPasso] = useState<Passo>({ etapa: "fechado" });
  /**
   * A confirmação vive aqui, fora do cartão, porque o cartão fecha quando a
   * gravação dá certo — e uma mensagem de sucesso que some junto com o
   * formulário deixa quem cadastrou sem saber se salvou.
   */
  const [sucesso, setSucesso] = useState("");

  function concluir(mensagem: string) {
    setSucesso(mensagem);
    setPasso({ etapa: "fechado" });
  }

  function abrir() {
    setSucesso("");
    setPasso((atual) =>
      atual.etapa === "fechado" ? { etapa: "pergunta" } : { etapa: "fechado" },
    );
  }

  const fechado = passo.etapa === "fechado";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={abrir} className={botaoPrincipal}>
          {fechado ? (
            <UserPlus className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
          {fechado ? "Cadastrar profissionais" : "Fechar"}
        </button>
      </div>

      {sucesso !== "" && fechado && (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-card bg-herval-verde/15 px-5 py-3 text-sm font-bold text-herval-preto"
        >
          <Check className="h-4 w-4" />
          {sucesso}
        </p>
      )}

      {passo.etapa === "pergunta" && (
        <Pergunta
          aoEscolherSozinho={() => setPasso({ etapa: "autonomo" })}
          aoEscolherEquipe={() => setPasso({ etapa: "cliente" })}
        />
      )}

      {passo.etapa === "autonomo" && (
        <FormularioPessoa
          titulo="Quem atende"
          acao={cadastrarAutonomo}
          especialidades={especialidades}
          unidades={null}
          aoVoltar={() => setPasso({ etapa: "pergunta" })}
          aoConcluir={(estado) => concluir(estado.mensagem)}
        />
      )}

      {passo.etapa === "cliente" && (
        <FormularioCliente
          clientes={clientes}
          aoVoltar={() => setPasso({ etapa: "pergunta" })}
          aoEscolherExistente={(cliente) =>
            setPasso({ etapa: "equipe", cliente, novo: false, cadastrados: [] })
          }
          aoCriar={(cliente) =>
            setPasso({ etapa: "equipe", cliente, novo: true, cadastrados: [] })
          }
        />
      )}

      {passo.etapa === "equipe" && (
        <Equipe
          passo={passo}
          especialidades={especialidades}
          aoCadastrar={(nome) =>
            setPasso({ ...passo, cadastrados: [...passo.cadastrados, nome] })
          }
          aoEncerrar={() => concluir(resumoDaEquipe(passo))}
        />
      )}
    </div>
  );
}

/** A frase que fica na tela depois de fechar o cadastro da equipe. */
function resumoDaEquipe(passo: Extract<Passo, { etapa: "equipe" }>) {
  const quantos = passo.cadastrados.length;
  const pessoas = quantos === 1 ? "1 profissional" : `${quantos} profissionais`;

  if (passo.novo) {
    return quantos === 0
      ? `Cliente "${passo.cliente.nome}" cadastrado. Ninguém atendendo ainda — dá para cadastrar depois.`
      : `Cliente "${passo.cliente.nome}" cadastrado com ${pessoas}.`;
  }

  return quantos === 0
    ? `Nada mudou em "${passo.cliente.nome}".`
    : `${pessoas} cadastrado${quantos === 1 ? "" : "s"} em "${passo.cliente.nome}".`;
}

/**
 * A primeira pergunta do fluxo, e a única que não é um campo.
 *
 * Ela existe porque a resposta muda o cadastro inteiro, não um campo dele: quem
 * atende sozinho não tem clínica para nomear nem unidade para escolher, e
 * mostrar esses campos com a instrução de repetir o próprio nome neles é o que
 * a tela fazia antes.
 */
function Pergunta({
  aoEscolherSozinho,
  aoEscolherEquipe,
}: {
  aoEscolherSozinho: () => void;
  aoEscolherEquipe: () => void;
}) {
  return (
    <Cartao titulo="Como é o atendimento?">
      <div className="grid gap-4 md:grid-cols-2">
        <Escolha
          icone={<User className="h-5 w-5" />}
          titulo="Atende sozinho"
          texto="Uma pessoa só. Não há outros profissionais no mesmo lugar."
          aoClicar={aoEscolherSozinho}
        />
        <Escolha
          icone={<Users className="h-5 w-5" />}
          titulo="Tem clínica ou equipe"
          texto="Mais de uma pessoa atendendo. Cadastramos a clínica e depois quem atende nela."
          aoClicar={aoEscolherEquipe}
        />
      </div>
    </Cartao>
  );
}

function Escolha({
  icone,
  titulo,
  texto,
  aoClicar,
}: {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="rounded-card border border-black/15 p-6 text-left transition-colors hover:border-herval-verde hover:bg-herval-verde/5"
    >
      <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-herval-verde/15 text-herval-preto">
        {icone}
      </span>
      <span className="block text-sm font-extrabold text-herval-preto">
        {titulo}
      </span>
      <span className="mt-1.5 block text-xs font-medium leading-relaxed text-black/50">
        {texto}
      </span>
    </button>
  );
}

/**
 * O primeiro passo do caminho "tem equipe": o nome da clínica.
 *
 * A lista de clientes já cadastrados fica aqui embaixo, e não num terceiro
 * caminho na pergunta da entrada: quem volta para adicionar mais gente numa
 * clínica que já existe está no mesmo caminho de quem acabou de criá-la — a
 * diferença é só se o nome precisa ser digitado ou já está no banco. Sem isso,
 * o único jeito de cadastrar alguém seria criar uma clínica nova toda vez.
 */
function FormularioCliente({
  clientes,
  aoVoltar,
  aoEscolherExistente,
  aoCriar,
}: {
  clientes: ClienteDoCadastro[];
  aoVoltar: () => void;
  aoEscolherExistente: (cliente: ClienteEmFoco) => void;
  aoCriar: (cliente: ClienteEmFoco) => void;
}) {
  const [estado, acao, enviando] = useActionState(
    cadastrarCliente,
    RESULTADO_INICIAL,
  );
  /** Controlado pelo mesmo motivo do outro formulário: o React limpa os
      campos quando a ação termina, inclusive quando ela recusou. */
  const [nome, setNome] = useState("");

  useQuandoDerCerto(estado, (resultado) => {
    // A ação devolve o cliente com a unidade que o gatilho criou. É o que
    // permite ir direto ao passo seguinte: esperar a página recarregar para
    // descobrir a unidade deixaria a lista de lugares vazia.
    if (resultado.cliente) aoCriar(resultado.cliente);
  });

  return (
    <Cartao titulo="A clínica" aoVoltar={aoVoltar}>
      {/* O `key` muda a cada resposta do servidor, o que redesenha o
          formulário a partir do estado guardado acima. Sem isso, o React
          esvazia os campos quando a ação termina — inclusive quando ela
          recusou — e quem errou um campo perde o que já tinha preenchido. */}
      <form key={estado.envio} action={acao} className="space-y-6">
        <div className="max-w-xl">
          <label htmlFor="cliente-nome" className={rotulo}>
            Nome da clínica
          </label>
          <input
            id="cliente-nome"
            name="nome"
            type="text"
            maxLength={120}
            autoComplete="off"
            placeholder="Ex.: Clínica Bella Face"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={campoBase}
          />
          <p className="mt-2 text-xs font-medium text-black/45">
            A primeira unidade é criada junto, com este mesmo nome. Só é preciso
            dar nome às unidades quando a clínica tiver mais de uma.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={enviando} className={botaoPrincipal}>
            <Plus className="h-4 w-4" />
            {enviando ? "Cadastrando…" : "Cadastrar e continuar"}
          </button>
          <Aviso estado={estado} />
        </div>
      </form>

      {clientes.length > 0 && (
        <div className="mt-8 border-t border-black/10 pt-6">
          <p className={rotulo}>Ou continue num cliente já cadastrado</p>
          <div className="flex flex-wrap gap-2">
            {clientes.map((cliente) => {
              const unidades = cliente.unidades.filter((u) => u.ativa);

              return (
                <button
                  key={cliente.id}
                  type="button"
                  disabled={unidades.length === 0}
                  onClick={() =>
                    aoEscolherExistente({
                      id: cliente.id,
                      nome: cliente.nome,
                      unidades: unidades.map((u) => ({
                        id: u.id,
                        nome: u.nome,
                      })),
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-black/15 px-4 py-2.5 text-xs font-bold text-black/70 transition-colors hover:border-herval-verde hover:text-herval-preto disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {cliente.nome}
                  {/* Sem unidade ativa não há onde encaixar ninguém. Dizer o
                      motivo evita que o botão apagado pareça defeito. */}
                  {unidades.length === 0 && " (sem unidade ativa)"}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Cartao>
  );
}

/**
 * O segundo passo do caminho "tem equipe": quem atende, um de cada vez.
 *
 * O formulário é o mesmo depois de cada gravação, e não um cartão novo por
 * pessoa: cadastrar equipe é digitar a mesma sequência de campos várias vezes,
 * e obrigar a clicar em "adicionar outro" antes de cada uma seria um clique a
 * mais por pessoa sem nada em troca. Quem já entrou fica listado acima.
 */
function Equipe({
  passo,
  especialidades,
  aoCadastrar,
  aoEncerrar,
}: {
  passo: Extract<Passo, { etapa: "equipe" }>;
  especialidades: EspecialidadeDoCadastro[];
  aoCadastrar: (nome: string) => void;
  aoEncerrar: () => void;
}) {
  return (
    <div className="space-y-5">
      <Cartao titulo={`Quem atende em ${passo.cliente.nome}`}>
        {passo.cadastrados.length > 0 && (
          <ul className="mb-7 flex flex-wrap gap-2">
            {passo.cadastrados.map((nome, indice) => (
              <li
                key={`${nome}-${indice}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-herval-verde/15 px-3.5 py-2 text-xs font-bold text-herval-preto"
              >
                <Check className="h-3.5 w-3.5" />
                {nome}
              </li>
            ))}
          </ul>
        )}

        {/* O `key` troca a cada pessoa gravada, o que devolve um formulário
            limpo para a próxima. Sem isso, o nome de quem acabou de entrar
            ficaria no campo, à espera de ser cadastrado duas vezes. */}
        <FormularioPessoa
          key={passo.cadastrados.length}
          acao={cadastrarProfissional}
          especialidades={especialidades}
          unidades={passo.cliente.unidades}
          aoConcluir={(_estado, nome) => aoCadastrar(nome)}
          semCartao
        />
      </Cartao>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={aoEncerrar} className={botaoSecundario}>
          <Check className="h-4 w-4" />
          {passo.cadastrados.length === 0
            ? "Concluir sem cadastrar ninguém"
            : "Concluir"}
        </button>
        <span className="text-xs font-medium text-black/45">
          Dá para voltar e adicionar mais gente depois.
        </span>
      </div>
    </div>
  );
}

/**
 * Os campos da pessoa. Serve aos dois caminhos.
 *
 * `unidades` nulo é o caminho "atende sozinho": não há onde escolher, porque a
 * única unidade é a que nasce junto com o cliente na mesma gravação.
 */
function FormularioPessoa({
  titulo,
  acao,
  especialidades,
  unidades,
  aoVoltar,
  aoConcluir,
  semCartao,
}: {
  titulo?: string;
  acao: (
    anterior: ResultadoDoCadastro,
    formData: FormData,
  ) => Promise<ResultadoDoCadastro>;
  especialidades: EspecialidadeDoCadastro[];
  unidades: { id: number; nome: string }[] | null;
  aoVoltar?: () => void;
  /** O nome vem junto porque quem chama monta a etiqueta de "já cadastrados". */
  aoConcluir: (estado: ResultadoDoCadastro, nome: string) => void;
  semCartao?: boolean;
}) {
  const [estado, executar, enviando] = useActionState(acao, RESULTADO_INICIAL);

  /**
   * Os campos são controlados pela tela, e não deixados por conta do
   * navegador, por um motivo que só aparece no erro: quando a ação termina, o
   * React limpa o formulário. Sem guardar o que foi digitado, quem errasse o
   * tipo perderia o nome já preenchido e teria que redigitar tudo.
   */
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [registro, setRegistro] = useState("");
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});

  // O nome sai do estado da tela, e não da frase que o servidor devolveu: o
  // campo continua preenchido no instante em que a gravação dá certo, e ler
  // dali é exato — garimpar o nome de dentro de uma frase quebraria calado no
  // dia em que a frase mudasse.
  useQuandoDerCerto(estado, (resultado) => aoConcluir(resultado, nome));

  /**
   * Especialidade inativa não entra na lista de marcar. Ela continua aparecendo
   * riscada em quem já a tinha — o histórico não se apaga —, mas oferecê-la num
   * cadastro novo seria convidar a marcar algo que a clínica deixou de atender.
   */
  const disponiveis = especialidades.filter((e) => e.ativa);

  const corpo = (
    /* Mesmo motivo do outro formulário: redesenhar a partir do estado
       depois de cada resposta. Aqui importa ainda mais, porque as caixas
       marcadas somem no esvaziamento e o texto digitado não. */
    <form key={estado.envio} action={executar} className="space-y-7">
      <div className="grid gap-5 md:grid-cols-3">
        <div>
          <label htmlFor="prof-nome" className={rotulo}>
            Nome
          </label>
          <input
            id="prof-nome"
            name="nome"
            type="text"
            maxLength={120}
            autoComplete="off"
            placeholder="Ex.: Dra. Ana Martins"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={campoBase}
          />
        </div>

        <div>
          <label htmlFor="prof-tipo" className={rotulo}>
            Tipo
          </label>
          <select
            id="prof-tipo"
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={campoBase}
          >
            <option value="" disabled>
              Escolha o tipo
            </option>
            {tiposDeProfissional.map((cargo) => (
              <option key={cargo} value={cargo}>
                {cargo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="prof-registro" className={rotulo}>
            Registro <span className="normal-case">(opcional)</span>
          </label>
          <input
            id="prof-registro"
            name="registro"
            type="text"
            maxLength={60}
            autoComplete="off"
            placeholder="Ex.: CRM 12345"
            value={registro}
            onChange={(e) => setRegistro(e.target.value)}
            className={campoBase}
          />
          <p className="mt-2 text-xs font-medium text-black/45">
            Nem todo cargo tem conselho de classe.
          </p>
        </div>
      </div>

      <fieldset>
        <legend className={rotulo}>Especialidades que atende</legend>
        {disponiveis.length === 0 ? (
          <p className="text-sm font-medium text-black/45">
            Nenhuma especialidade ativa cadastrada ainda. Dá para cadastrar a
            pessoa assim e marcar depois.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {disponiveis.map((especialidade) => (
              <Marcador
                key={especialidade.id}
                campo="especialidades"
                valor={especialidade.id}
                texto={especialidade.nome}
                marcados={marcados}
                aoMarcar={setMarcados}
              />
            ))}
          </div>
        )}
      </fieldset>

      <Unidades
        unidades={unidades}
        marcados={marcados}
        aoMarcar={setMarcados}
      />

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={enviando} className={botaoPrincipal}>
          <Plus className="h-4 w-4" />
          {enviando ? "Cadastrando…" : "Cadastrar profissional"}
        </button>
        <Aviso estado={estado} />
      </div>
    </form>
  );

  if (semCartao) return corpo;

  return (
    <Cartao titulo={titulo ?? "Quem atende"} aoVoltar={aoVoltar}>
      {corpo}
    </Cartao>
  );
}

/**
 * Onde a pessoa atende.
 *
 * Três casos, e a diferença entre eles não é enfeite:
 *
 *   sem lista       caminho "atende sozinho". A unidade nasce na mesma
 *                   gravação, então não existe nada para escolher ainda.
 *   uma unidade só  a escolha seria entre uma opção e nenhuma. Vira uma frase
 *                   e um campo escondido — quem tem um lugar só nunca precisa
 *                   saber que "unidade" existe.
 *   mais de uma     aí sim é uma escolha, e aparece como escolha.
 */
function Unidades({
  unidades,
  marcados,
  aoMarcar,
}: {
  unidades: { id: number; nome: string }[] | null;
  marcados: Record<string, boolean>;
  aoMarcar: (
    mudar: (atual: Record<string, boolean>) => Record<string, boolean>,
  ) => void;
}) {
  if (unidades === null) return null;

  if (unidades.length === 1) {
    return (
      <div>
        <p className={rotulo}>Onde atende</p>
        <input type="hidden" name="unidades" value={unidades[0].id} />
        <p className="text-sm font-medium text-black/60">{unidades[0].nome}</p>
      </div>
    );
  }

  return (
    <fieldset>
      <legend className={rotulo}>Em qual unidade atende</legend>
      <div className="flex flex-wrap gap-2">
        {unidades.map((unidade) => (
          <Marcador
            key={unidade.id}
            campo="unidades"
            valor={unidade.id}
            texto={unidade.nome}
            marcados={marcados}
            aoMarcar={aoMarcar}
          />
        ))}
      </div>
      <p className="mt-2 text-xs font-medium text-black/45">
        Dá para marcar mais de uma, se a pessoa atende em mais de um lugar.
      </p>
    </fieldset>
  );
}

/**
 * Uma caixa de marcar com cara de etiqueta, igual às da tabela. Também
 * controlada, pelo mesmo motivo dos campos de texto: o que foi marcado
 * precisa sobreviver a um erro de validação.
 */
function Marcador({
  campo,
  valor,
  texto,
  marcados,
  aoMarcar,
}: {
  campo: string;
  valor: number;
  texto: string;
  marcados: Record<string, boolean>;
  aoMarcar: (
    mudar: (atual: Record<string, boolean>) => Record<string, boolean>,
  ) => void;
}) {
  const chave = `${campo}-${valor}`;

  return (
    <label className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/15 px-3.5 py-2 text-xs font-bold text-black/70 transition-colors has-[:checked]:border-herval-verde has-[:checked]:bg-herval-verde/15 has-[:checked]:text-herval-preto">
      <input
        type="checkbox"
        name={campo}
        value={valor}
        checked={marcados[chave] ?? false}
        onChange={(e) =>
          aoMarcar((atual) => ({ ...atual, [chave]: e.target.checked }))
        }
        className="h-3.5 w-3.5 accent-herval-verde"
      />
      {texto}
    </label>
  );
}

function Cartao({
  titulo,
  aoVoltar,
  children,
}: {
  titulo: string;
  aoVoltar?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
          <span className="h-4 w-1 rounded-full bg-herval-verde" />
          {titulo}
        </h2>
        {aoVoltar && (
          <button
            type="button"
            onClick={aoVoltar}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/** A resposta do servidor, do lado do botão. Erro e acerto não se parecem. */
function Aviso({ estado }: { estado: ResultadoDoCadastro }) {
  if (estado.mensagem === "") return null;

  return (
    <span
      role="status"
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold",
        estado.ok
          ? "bg-herval-verde/15 text-herval-preto"
          : "border border-herval-vermelho/40 text-herval-preto",
      ].join(" ")}
    >
      {estado.ok ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <AlertCircle className="h-3.5 w-3.5" />
      )}
      {estado.mensagem}
    </span>
  );
}

/**
 * Avisa o passo seguinte quando a gravação dá certo.
 *
 * Compara o número do envio, e não o `ok`: sem isso, um segundo cadastro
 * bem-sucedido não avisaria nada, porque o estado já estaria em `ok` desde o
 * primeiro e o efeito não voltaria a rodar.
 */
function useQuandoDerCerto(
  estado: ResultadoDoCadastro,
  aoConcluir: (estado: ResultadoDoCadastro) => void,
) {
  const ultimoEnvio = useRef(0);
  /** O aviso muda de identidade a cada desenho; a referência não. */
  const guardado = useRef(aoConcluir);
  guardado.current = aoConcluir;

  useEffect(() => {
    if (estado.ok && estado.envio !== ultimoEnvio.current) {
      ultimoEnvio.current = estado.envio;
      guardado.current(estado);
    }
  }, [estado]);
}
