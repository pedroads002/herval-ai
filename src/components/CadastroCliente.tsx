"use client";

import { useActionState, useState } from "react";
import { Building2, Check, Plus, User, UserPlus, Users, X } from "lucide-react";
import {
  cadastrarCliente,
  cadastrarIndividual,
  cadastrarProfissional,
} from "@/lib/acoes/profissionais";
import { RESULTADO_INICIAL } from "@/lib/acoes/resultadoDoCadastro";
import type { ResultadoDoCadastro } from "@/lib/acoes/resultadoDoCadastro";
import type {
  ClienteDoCadastro,
  EspecialidadeDoCadastro,
  TipoDeOperacao,
} from "@/lib/dados/profissionais";
import {
  Aviso,
  botaoPrincipal,
  botaoSecundario,
  CamposDaPessoa,
  CamposDoCliente,
  CamposDoIndividual,
  Cartao,
  HorariosNasUnidades,
  Unidades,
  useMarcados,
  useQuandoDerCerto,
  useValores,
} from "@/components/cadastro/comuns";

/**
 * O cadastro da seção — **uma porta de entrada só.**
 *
 * A tela pergunta o que ela precisa saber — como funciona este cliente? — e
 * conduz o resto. Os dois caminhos:
 *
 *   PROFISSIONAL INDIVIDUAL  um formulário só. O nome serve ao cliente e à
 *                            pessoa, que são a mesma. Uma gravação, um passo.
 *   CLÍNICA OU EQUIPE        os dados da operação primeiro, e na sequência,
 *                            sem sair da tela, quantas pessoas atendem nela.
 *
 * No banco os dois viram a mesma coisa: uma linha em `clinicas` com os
 * profissionais pendurados. O que muda é o formulário, não o modelo.
 */

/** Um cliente recém-criado ou já existente, do jeito que o passo da equipe usa. */
type ClienteEmFoco = {
  id: number;
  nome: string;
  unidades: { id: number; nome: string }[];
};

type Passo =
  | { etapa: "fechado" }
  | { etapa: "pergunta" }
  | { etapa: "individual" }
  | { etapa: "cliente" }
  | {
      etapa: "equipe";
      cliente: ClienteEmFoco;
      /** Falso quando a clínica já estava cadastrada antes deste fluxo. */
      novo: boolean;
      /** Quem já foi cadastrado nesta passagem, para a tela ir mostrando. */
      cadastrados: string[];
    };

export default function CadastroCliente({
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
          {fechado ? "Cadastrar cliente" : "Fechar"}
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
          aoEscolherIndividual={() => setPasso({ etapa: "individual" })}
          aoEscolherEquipe={() => setPasso({ etapa: "cliente" })}
        />
      )}

      {passo.etapa === "individual" && (
        <FormularioIndividual
          especialidades={especialidades}
          aoVoltar={() => setPasso({ etapa: "pergunta" })}
          aoConcluir={(estado) => concluir(estado.mensagem)}
        />
      )}

      {passo.etapa === "cliente" && (
        <FormularioDaOperacao
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
 * atende sozinho não tem clínica para nomear nem equipe para listar, e mostrar
 * esses campos com a instrução de repetir o próprio nome neles é o que a tela
 * fazia antes.
 */
function Pergunta({
  aoEscolherIndividual,
  aoEscolherEquipe,
}: {
  aoEscolherIndividual: () => void;
  aoEscolherEquipe: () => void;
}) {
  return (
    <Cartao titulo="Como funciona este cliente?">
      <div className="grid gap-4 md:grid-cols-2">
        <Escolha
          icone={<User className="h-5 w-5" />}
          titulo="Profissional individual"
          texto="Atende sozinho e utiliza seu próprio canal de atendimento."
          aoClicar={aoEscolherIndividual}
        />
        <Escolha
          icone={<Users className="h-5 w-5" />}
          titulo="Clínica ou equipe"
          texto="A operação possui mais de um profissional utilizando o mesmo canal de atendimento."
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

/** O caminho "profissional individual": cliente e pessoa numa gravação só. */
function FormularioIndividual({
  especialidades,
  aoVoltar,
  aoConcluir,
}: {
  especialidades: EspecialidadeDoCadastro[];
  aoVoltar: () => void;
  aoConcluir: (estado: ResultadoDoCadastro) => void;
}) {
  const [estado, executar, enviando] = useActionState(
    cadastrarIndividual,
    RESULTADO_INICIAL,
  );

  /**
   * Os campos são controlados pela tela, e não deixados por conta do
   * navegador, por um motivo que só aparece no erro: quando a ação termina, o
   * React limpa o formulário. Sem guardar o que foi digitado, quem errasse um
   * campo perderia tudo o que já tinha preenchido.
   */
  const { valores, mudar } = useValores({});
  const { marcados, setMarcados } = useMarcados({});
  const [ativa, setAtiva] = useState(true);

  useQuandoDerCerto(estado, aoConcluir);

  return (
    <Cartao titulo="Profissional individual" aoVoltar={aoVoltar}>
      {/* O `key` muda a cada resposta do servidor, o que redesenha o
          formulário a partir do estado guardado acima. Sem isso, o React
          esvazia os campos quando a ação termina — inclusive quando ela
          recusou — e quem errou um campo perde o que já tinha preenchido. */}
      <form key={estado.envio} action={executar} className="space-y-8">
        <CamposDoIndividual
          valores={valores}
          aoMudar={mudar}
          ativa={ativa}
          aoMudarStatus={setAtiva}
          marcados={marcados}
          aoMarcar={setMarcados}
          especialidades={especialidades}
        />

        <div className="flex flex-wrap items-center gap-4 border-t border-black/10 pt-7">
          <button type="submit" disabled={enviando} className={botaoPrincipal}>
            <Plus className="h-4 w-4" />
            {enviando ? "Cadastrando…" : "Cadastrar cliente"}
          </button>
          <Aviso estado={estado} />
        </div>
      </form>
    </Cartao>
  );
}

/**
 * O primeiro passo do caminho "clínica ou equipe": os dados da operação.
 *
 * A lista de clientes já cadastrados fica aqui embaixo, e não num terceiro
 * caminho na pergunta da entrada: quem volta para adicionar mais gente numa
 * clínica que já existe está no mesmo caminho de quem acabou de criá-la — a
 * diferença é só se os dados precisam ser digitados ou já estão no banco.
 */
function FormularioDaOperacao({
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
  const [estado, executar, enviando] = useActionState(
    cadastrarCliente,
    RESULTADO_INICIAL,
  );
  const { valores, mudar } = useValores({});
  const [ativa, setAtiva] = useState(true);

  useQuandoDerCerto(estado, (resultado) => {
    // A ação devolve o cliente com a unidade que o gatilho criou. É o que
    // permite ir direto ao passo seguinte: esperar a página recarregar para
    // descobrir a unidade deixaria a lista de lugares vazia.
    if (resultado.cliente) aoCriar(resultado.cliente);
  });

  const comEquipe = clientes.filter((c) => c.tipoOperacao === "equipe");

  return (
    <Cartao titulo="Clínica ou equipe" aoVoltar={aoVoltar}>
      <form key={estado.envio} action={executar} className="space-y-8">
        <CamposDoCliente
          tipoOperacao="equipe"
          valores={valores}
          aoMudar={mudar}
          ativa={ativa}
          aoMudarStatus={setAtiva}
        />

        <div className="flex flex-wrap items-center gap-4 border-t border-black/10 pt-7">
          <button type="submit" disabled={enviando} className={botaoPrincipal}>
            <Plus className="h-4 w-4" />
            {enviando ? "Cadastrando…" : "Cadastrar e continuar"}
          </button>
          <Aviso estado={estado} />
        </div>
      </form>

      {comEquipe.length > 0 && (
        <div className="mt-8 border-t border-black/10 pt-6">
          <p className="mb-2 block text-xs font-bold uppercase tracking-wide text-black/50">
            Ou continue numa clínica já cadastrada
          </p>
          <div className="flex flex-wrap gap-2">
            {comEquipe.map((cliente) => {
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
 * O segundo passo do caminho "clínica ou equipe": quem atende, um de cada vez.
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
        <FormularioDaPessoa
          key={passo.cadastrados.length}
          cliente={passo.cliente}
          especialidades={especialidades}
          aoConcluir={aoCadastrar}
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

function FormularioDaPessoa({
  cliente,
  especialidades,
  aoConcluir,
}: {
  cliente: ClienteEmFoco;
  especialidades: EspecialidadeDoCadastro[];
  aoConcluir: (nome: string) => void;
}) {
  const [estado, executar, enviando] = useActionState(
    cadastrarProfissional,
    RESULTADO_INICIAL,
  );
  const { valores, mudar } = useValores({});
  const { marcados, setMarcados } = useMarcados({});
  const [ativo, setAtivo] = useState(true);

  // O nome sai do estado da tela, e não da frase que o servidor devolveu: o
  // campo continua preenchido no instante em que a gravação dá certo, e ler
  // dali é exato — garimpar o nome de dentro de uma frase quebraria calado no
  // dia em que a frase mudasse.
  useQuandoDerCerto(estado, () => aoConcluir(valores.nome ?? "Profissional"));

  return (
    <form key={estado.envio} action={executar} className="space-y-7">
      <input type="hidden" name="cliente" value={cliente.id} />

      <CamposDaPessoa
        valores={valores}
        aoMudar={mudar}
        ativo={ativo}
        aoMudarStatus={setAtivo}
        marcados={marcados}
        aoMarcar={setMarcados}
        especialidades={especialidades}
      />

      <Unidades
        unidades={cliente.unidades}
        marcados={marcados}
        aoMarcar={setMarcados}
      />

      <HorariosNasUnidades
        unidades={cliente.unidades}
        marcados={marcados}
        aoMarcar={setMarcados}
        valores={valores}
        aoMudar={mudar}
      />

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={enviando} className={botaoPrincipal}>
          <Plus className="h-4 w-4" />
          {enviando ? "Cadastrando…" : "Adicionar profissional"}
        </button>
        <Aviso estado={estado} />
      </div>
    </form>
  );
}

/** Reexportado para a tela do cliente, que cadastra gente no mesmo formato. */
export type { ClienteEmFoco, TipoDeOperacao };
