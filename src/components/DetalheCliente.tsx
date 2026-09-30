"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Save,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  cadastrarProfissional,
  editarCliente,
  editarIndividual,
  editarProfissional,
  excluirCliente,
  excluirProfissional,
} from "@/lib/acoes/profissionais";
import { RESULTADO_INICIAL } from "@/lib/acoes/resultadoDoCadastro";
import type {
  ClienteDoCadastro,
  EspecialidadeDoCadastro,
  ProfissionalCadastrado,
} from "@/lib/dados/profissionais";
import {
  Aviso,
  botaoPerigo,
  botaoPrincipal,
  botaoSecundario,
  CamposDaPessoa,
  CamposDoCliente,
  CamposDoIndividual,
  Cartao,
  marcarIds,
  Unidades,
  useMarcados,
  useQuandoDerCerto,
  useValores,
} from "@/components/cadastro/comuns";
import UnidadesDoCliente from "@/components/UnidadesDoCliente";

/**
 * A tela de um cliente: os dados dele, quem atende nele, e o que cada pessoa
 * realiza.
 *
 * Os dois tipos de cliente abrem telas diferentes de propósito. Quem atende
 * sozinho é uma pessoa só: os dados do cliente e os da pessoa vivem no mesmo
 * formulário, porque separá-los criaria dois nomes para o mesmo ser humano,
 * que um dia deixariam de bater. Clínica tem os dados da operação em cima e a
 * equipe embaixo, cada pessoa com os próprios procedimentos.
 */
export default function DetalheCliente({
  cliente,
  especialidades,
}: {
  cliente: ClienteDoCadastro;
  especialidades: EspecialidadeDoCadastro[];
}) {
  const individual = cliente.tipoOperacao === "individual";
  const pessoa = cliente.profissionais[0] ?? null;

  return (
    <div className="space-y-6">
      {individual ? (
        <FormularioIndividual
          cliente={cliente}
          pessoa={pessoa}
          especialidades={especialidades}
        />
      ) : (
        <FormularioDaOperacao cliente={cliente} />
      )}

      {/* Os lugares vêm antes da equipe porque é neles que a equipe é
          encaixada: quem cadastra alguém precisa que a unidade dele já exista.
          Aparece nos dois tipos de cliente — atender em dois endereços não é
          coisa só de clínica com equipe. */}
      <UnidadesDoCliente cliente={cliente} />

      {/* Quem atende sozinho já foi editado no bloco de cima. A lista de
          equipe só aparece quando existe equipe — ou quando o cliente
          individual está sem ninguém, que é um cadastro pela metade e precisa
          de um caminho para ser consertado. */}
      {(!individual || pessoa === null) && (
        <Equipe cliente={cliente} especialidades={especialidades} />
      )}

      <ExcluirCliente cliente={cliente} />
    </div>
  );
}

/** Cliente individual: os dados do cliente e os da pessoa, num formulário só. */
function FormularioIndividual({
  cliente,
  pessoa,
  especialidades,
}: {
  cliente: ClienteDoCadastro;
  pessoa: ProfissionalCadastrado | null;
  especialidades: EspecialidadeDoCadastro[];
}) {
  const [estado, executar, enviando] = useActionState(
    editarIndividual,
    RESULTADO_INICIAL,
  );

  const { valores, mudar } = useValores({
    nome: cliente.nome,
    nome_exibicao: cliente.nomeExibicao || pessoa?.nomeExibicao || "",
    area_atuacao: cliente.areaAtuacao,
    especialidade_principal: pessoa?.especialidadePrincipal ?? "",
    registro: pessoa?.registro ?? "",
    procedimento_outro: pessoa?.procedimentoOutro ?? "",
    whatsapp: cliente.whatsapp,
    email: cliente.email,
    instagram: cliente.instagram,
    cidade: cliente.cidade,
    estado: cliente.estado,
    endereco: cliente.endereco,
    descricao: cliente.descricao,
  });
  const { marcados, setMarcados } = useMarcados(
    marcarIds(
      "especialidades",
      (pessoa?.especialidades ?? []).map((e) => e.id),
    ),
  );
  const [ativa, setAtiva] = useState(cliente.ativa);

  return (
    <Cartao titulo="Profissional individual">
      <form key={estado.envio} action={executar} className="space-y-8">
        <input type="hidden" name="id" value={cliente.id} />
        {pessoa && (
          <input type="hidden" name="profissional" value={pessoa.id} />
        )}

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
            <Save className="h-4 w-4" />
            {enviando ? "Salvando…" : "Salvar alterações"}
          </button>
          <Aviso estado={estado} />
        </div>
      </form>
    </Cartao>
  );
}

/** Clínica ou equipe: os dados da operação. */
function FormularioDaOperacao({ cliente }: { cliente: ClienteDoCadastro }) {
  const [estado, executar, enviando] = useActionState(
    editarCliente,
    RESULTADO_INICIAL,
  );

  const { valores, mudar } = useValores({
    nome: cliente.nome,
    responsavel_principal: cliente.responsavelPrincipal,
    area_atuacao: cliente.areaAtuacao,
    whatsapp: cliente.whatsapp,
    email: cliente.email,
    instagram: cliente.instagram,
    cidade: cliente.cidade,
    estado: cliente.estado,
    endereco: cliente.endereco,
    descricao: cliente.descricao,
  });
  const [ativa, setAtiva] = useState(cliente.ativa);

  return (
    <Cartao titulo="Dados da operação">
      <form key={estado.envio} action={executar} className="space-y-8">
        <input type="hidden" name="id" value={cliente.id} />
        <input type="hidden" name="tipo_operacao" value="equipe" />

        <CamposDoCliente
          tipoOperacao="equipe"
          valores={valores}
          aoMudar={mudar}
          ativa={ativa}
          aoMudarStatus={setAtiva}
        />

        <div className="flex flex-wrap items-center gap-4 border-t border-black/10 pt-7">
          <button type="submit" disabled={enviando} className={botaoPrincipal}>
            <Save className="h-4 w-4" />
            {enviando ? "Salvando…" : "Salvar alterações"}
          </button>
          <Aviso estado={estado} />
        </div>
      </form>
    </Cartao>
  );
}

/** Quem atende no cliente: a lista, a edição de cada um e o cadastro de mais. */
function Equipe({
  cliente,
  especialidades,
}: {
  cliente: ClienteDoCadastro;
  especialidades: EspecialidadeDoCadastro[];
}) {
  /** Qual pessoa está aberta. Uma de cada vez: duas abertas é rolagem à toa. */
  const [aberto, setAberto] = useState<number | null>(null);
  const [adicionando, setAdicionando] = useState(false);

  const unidades = cliente.unidades
    .filter((u) => u.ativa)
    .map((u) => ({ id: u.id, nome: u.nome }));

  return (
    <Cartao
      titulo="Profissionais"
      acoes={
        <button
          type="button"
          onClick={() => {
            setAdicionando((atual) => !atual);
            setAberto(null);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
        >
          {adicionando ? (
            <X className="h-3.5 w-3.5" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {adicionando ? "Cancelar" : "Adicionar profissional"}
        </button>
      }
    >
      {cliente.profissionais.length === 0 && !adicionando && (
        <p className="text-sm font-medium text-black/55">
          Ninguém atende neste cliente ainda. A Helô não tem a quem encaminhar
          um lead até que alguém seja cadastrado aqui.
        </p>
      )}

      {cliente.profissionais.length > 0 && (
        <ul className="space-y-3">
          {cliente.profissionais.map((pessoa) => (
            <li
              key={pessoa.id}
              className="overflow-hidden rounded-card border border-black/10"
            >
              <button
                type="button"
                onClick={() =>
                  setAberto((atual) => (atual === pessoa.id ? null : pessoa.id))
                }
                className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-herval-verde/[0.06]"
              >
                <span className="mt-0.5 text-black/40">
                  {aberto === pessoa.id ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-bold text-herval-preto">
                    {pessoa.nomeExibicao || pessoa.nome}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-black/50">
                    {[
                      pessoa.nome,
                      pessoa.especialidadePrincipal,
                      pessoa.registro,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <ResumoDosProcedimentos pessoa={pessoa} />
                </span>
                {!pessoa.ativo && (
                  <span className="rounded-full border border-black/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black/45">
                    Inativo
                  </span>
                )}
              </button>

              {aberto === pessoa.id && (
                <div className="border-t border-black/10 px-5 py-6">
                  <FormularioDaPessoa
                    cliente={cliente}
                    pessoa={pessoa}
                    especialidades={especialidades}
                    aoSalvar={() => setAberto(null)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {adicionando && (
        <div
          className={
            cliente.profissionais.length > 0
              ? "mt-6 border-t border-black/10 pt-6"
              : ""
          }
        >
          <FormularioDaPessoa
            cliente={cliente}
            pessoa={null}
            unidades={unidades}
            especialidades={especialidades}
            aoSalvar={() => setAdicionando(false)}
          />
        </div>
      )}
    </Cartao>
  );
}

function ResumoDosProcedimentos({
  pessoa,
}: {
  pessoa: ProfissionalCadastrado;
}) {
  const nomes = pessoa.especialidades.map((e) => e.nome);
  if (pessoa.procedimentoOutro) nomes.push(pessoa.procedimentoOutro);

  if (nomes.length === 0) {
    return (
      <span className="mt-2 block text-xs font-medium text-black/35">
        Nenhum procedimento marcado
      </span>
    );
  }

  return (
    <span className="mt-2 flex flex-wrap gap-1.5">
      {nomes.map((nome) => (
        <span
          key={nome}
          className="rounded-full bg-herval-verde/15 px-2.5 py-1 text-xs font-bold text-herval-preto"
        >
          {nome}
        </span>
      ))}
    </span>
  );
}

/**
 * O formulário de uma pessoa. Serve para cadastrar e para editar.
 *
 * É o mesmo componente nos dois casos porque os campos são os mesmos — o que
 * muda é a ação e o que já vem preenchido. Dois formulários iguais lado a lado
 * ficariam diferentes na primeira vez que alguém mexesse em um só.
 */
function FormularioDaPessoa({
  cliente,
  pessoa,
  unidades,
  especialidades,
  aoSalvar,
}: {
  cliente: ClienteDoCadastro;
  pessoa: ProfissionalCadastrado | null;
  unidades?: { id: number; nome: string }[];
  especialidades: EspecialidadeDoCadastro[];
  aoSalvar: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    pessoa ? editarProfissional : cadastrarProfissional,
    RESULTADO_INICIAL,
  );

  const { valores, mudar } = useValores({
    nome: pessoa?.nome ?? "",
    nome_exibicao: pessoa?.nomeExibicao ?? "",
    especialidade_principal: pessoa?.especialidadePrincipal ?? "",
    registro: pessoa?.registro ?? "",
    procedimento_outro: pessoa?.procedimentoOutro ?? "",
  });
  const { marcados, setMarcados } = useMarcados(
    marcarIds(
      "especialidades",
      (pessoa?.especialidades ?? []).map((e) => e.id),
    ),
  );
  const [ativo, setAtivo] = useState(pessoa?.ativo ?? true);

  useQuandoDerCerto(estado, aoSalvar);

  return (
    <form key={estado.envio} action={executar} className="space-y-7">
      <input type="hidden" name="cliente" value={cliente.id} />
      {pessoa && <input type="hidden" name="id" value={pessoa.id} />}

      <CamposDaPessoa
        valores={valores}
        aoMudar={mudar}
        ativo={ativo}
        aoMudarStatus={setAtivo}
        marcados={marcados}
        aoMarcar={setMarcados}
        especialidades={especialidades}
      />

      {/* Só no cadastro: onde a pessoa atende já está gravado quando ela
          existe, e mexer nisso é outra conversa — mudar de unidade não é
          corrigir um dado, é mudar de lugar de trabalho. */}
      {!pessoa && unidades && (
        <Unidades
          unidades={unidades}
          marcados={marcados}
          aoMarcar={setMarcados}
        />
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={enviando} className={botaoPrincipal}>
          {pessoa ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {enviando
            ? pessoa
              ? "Salvando…"
              : "Cadastrando…"
            : pessoa
              ? "Salvar alterações"
              : "Cadastrar profissional"}
        </button>
        {pessoa && <ExcluirProfissional cliente={cliente} pessoa={pessoa} />}
        <Aviso estado={estado} />
      </div>
    </form>
  );
}

/**
 * Exclusão em dois cliques.
 *
 * O primeiro clique troca o botão por uma pergunta; o segundo apaga. Não é
 * enfeite: apagar é a única ação desta tela que não tem volta, e um botão de
 * um clique ao lado de "salvar" apaga cadastro por engano de mira.
 *
 * Fica fora do `<form>` principal como um formulário próprio — botão de apagar
 * dentro do formulário de salvar enviaria os dois juntos.
 */
function ExcluirProfissional({
  cliente,
  pessoa,
}: {
  cliente: ClienteDoCadastro;
  pessoa: ProfissionalCadastrado;
}) {
  const [estado, executar, enviando] = useActionState(
    excluirProfissional,
    RESULTADO_INICIAL,
  );
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className={botaoSecundario}
      >
        <Trash2 className="h-4 w-4" />
        Excluir
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <span className="text-xs font-bold text-herval-preto">
        Excluir {pessoa.nomeExibicao || pessoa.nome}?
      </span>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
      >
        Cancelar
      </button>
      <button
        type="button"
        disabled={enviando}
        onClick={() => {
          const dados = new FormData();
          dados.set("id", String(pessoa.id));
          dados.set("cliente", String(cliente.id));
          executar(dados);
        }}
        className={botaoPerigo}
      >
        <Trash2 className="h-4 w-4" />
        {enviando ? "Excluindo…" : "Sim, excluir"}
      </button>
      <Aviso estado={estado} />
    </span>
  );
}

/** A exclusão do cliente inteiro, com o mesmo cuidado e um aviso a mais. */
function ExcluirCliente({ cliente }: { cliente: ClienteDoCadastro }) {
  const [estado, executar, enviando] = useActionState(
    excluirCliente,
    RESULTADO_INICIAL,
  );
  const [confirmando, setConfirmando] = useState(false);
  const router = useRouter();

  // Depois de apagar, a tela deste cliente não existe mais. Ficar nela
  // mostrando dados de algo que foi apagado é pior que voltar para a lista.
  useQuandoDerCerto(estado, () => router.push("/clientes"));

  const quantos = cliente.profissionais.length;

  return (
    <section className="rounded-card border border-black/10 bg-herval-branco p-7 shadow-card">
      <h2 className="mb-2 flex items-center gap-2.5 text-sm font-extrabold uppercase tracking-wide text-herval-preto">
        <span className="h-4 w-1 rounded-full bg-herval-vermelho" />
        Excluir cliente
      </h2>
      <p className="mb-6 max-w-2xl text-sm font-medium text-black/55">
        Apaga o cliente
        {quantos > 0 &&
          ` e ${quantos === 1 ? "o profissional" : `os ${quantos} profissionais`} que atende${quantos === 1 ? "" : "m"} nele`}
        . Não tem volta. Se o cliente já tiver leads no Atendimento, a exclusão
        é recusada — conversa não se apaga junto com cadastro.
      </p>

      {confirmando ? (
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-bold text-herval-preto">
            Excluir &quot;{cliente.nome}&quot; de vez?
          </span>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={() => {
              const dados = new FormData();
              dados.set("id", String(cliente.id));
              executar(dados);
            }}
            className={botaoPerigo}
          >
            <Trash2 className="h-4 w-4" />
            {enviando ? "Excluindo…" : "Sim, excluir"}
          </button>
          <Aviso estado={estado} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className={botaoPerigo}
        >
          <Trash2 className="h-4 w-4" />
          Excluir cliente
        </button>
      )}
    </section>
  );
}

/** O cabeçalho da tela, com o tipo de operação à vista. */
export function ResumoDoCliente({ cliente }: { cliente: ClienteDoCadastro }) {
  const individual = cliente.tipoOperacao === "individual";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/20 px-3 py-1 text-xs font-bold text-black/65">
      {individual ? (
        <User className="h-3.5 w-3.5" />
      ) : (
        <Building2 className="h-3.5 w-3.5" />
      )}
      {individual ? "Profissional individual" : "Clínica ou equipe"}
      {!cliente.ativa && (
        <>
          <span className="text-black/25">·</span>
          Inativo
        </>
      )}
      {cliente.ativa && (
        <>
          <span className="text-black/25">·</span>
          <Check className="h-3.5 w-3.5 text-herval-verde" />
          Ativo
        </>
      )}
    </span>
  );
}
