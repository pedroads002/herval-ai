"use client";

import { useActionState, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  cadastrarUnidade,
  editarUnidade,
  excluirUnidade,
} from "@/lib/acoes/profissionais";
import { RESULTADO_INICIAL } from "@/lib/acoes/resultadoDoCadastro";
import type {
  ClienteDoCadastro,
  UnidadeDoCadastro,
} from "@/lib/dados/profissionais";
import {
  Aviso,
  botaoPerigo,
  botaoPrincipal,
  botaoSecundario,
  Campo,
  Cartao,
  Status,
  useQuandoDerCerto,
  useValores,
} from "@/components/cadastro/comuns";

/**
 * Os lugares de um cliente: a lista, a edição de cada um e o cadastro de mais.
 *
 * Todo cliente nasce com uma unidade, criada pelo gatilho do banco com o nome
 * do próprio cliente. Quem atende num lugar só nunca precisa abrir este cartão
 * — ele existe para o cliente que abriu o segundo endereço, que até agora não
 * tinha como ser representado no painel.
 *
 * Endereço e cidade aqui são do lugar, não do cliente. O cliente tem os dele
 * nos dados da operação, que respondem pelo endereço principal; quando existem
 * dois lugares, um endereço só não diz qual é qual.
 */
export default function UnidadesDoCliente({
  cliente,
}: {
  cliente: ClienteDoCadastro;
}) {
  /** Qual unidade está aberta. Uma de cada vez, como na lista de pessoas. */
  const [aberta, setAberta] = useState<number | null>(null);
  const [adicionando, setAdicionando] = useState(false);

  const nenhumaAtiva =
    cliente.unidades.length > 0 && cliente.unidades.every((u) => !u.ativa);

  return (
    <Cartao
      titulo="Unidades"
      acoes={
        <button
          type="button"
          onClick={() => {
            setAdicionando((atual) => !atual);
            setAberta(null);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
        >
          {adicionando ? (
            <X className="h-3.5 w-3.5" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {adicionando ? "Cancelar" : "Adicionar unidade"}
        </button>
      }
    >
      {/* Sem unidade ativa ninguém novo pode ser cadastrado no cliente. O
          cadastro de profissional recusa nesse caso, e o motivo dele ("marque
          um lugar") não explica que não há lugar para marcar. */}
      {nenhumaAtiva && (
        <p className="mb-5 rounded-controle border border-herval-vermelho/40 px-4 py-3 text-sm font-medium text-herval-preto">
          Nenhuma unidade deste cliente está ativa. Enquanto for assim, não dá
          para cadastrar quem atende nele.
        </p>
      )}

      {cliente.unidades.length === 0 && (
        <p className="text-sm font-medium text-black/55">
          Este cliente está sem unidade nenhuma, o que não deveria acontecer:
          ninguém pode ser cadastrado para atender nele. Cadastre uma unidade
          aqui.
        </p>
      )}

      {cliente.unidades.length > 0 && (
        <ul className="space-y-3">
          {cliente.unidades.map((unidade) => (
            <li
              key={unidade.id}
              className="overflow-hidden rounded-card border border-black/10"
            >
              <button
                type="button"
                onClick={() =>
                  setAberta((atual) =>
                    atual === unidade.id ? null : unidade.id,
                  )
                }
                className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-herval-verde/[0.06]"
              >
                <span className="mt-0.5 text-black/40">
                  {aberta === unidade.id ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-bold text-herval-preto">
                    {unidade.nome}
                  </span>
                  <Endereco unidade={unidade} />
                </span>
                {!unidade.ativa && (
                  <span className="rounded-full border border-black/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black/45">
                    Inativa
                  </span>
                )}
              </button>

              {aberta === unidade.id && (
                <div className="border-t border-black/10 px-5 py-6">
                  <FormularioDaUnidade
                    cliente={cliente}
                    unidade={unidade}
                    aoSalvar={() => setAberta(null)}
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
            cliente.unidades.length > 0
              ? "mt-6 border-t border-black/10 pt-6"
              : ""
          }
        >
          <FormularioDaUnidade
            cliente={cliente}
            unidade={null}
            aoSalvar={() => setAdicionando(false)}
          />
        </div>
      )}
    </Cartao>
  );
}

/** Endereço e cidade em uma linha, e um lembrete quando não há nenhum dos dois. */
function Endereco({ unidade }: { unidade: UnidadeDoCadastro }) {
  const partes = [unidade.endereco, unidade.cidade].filter(Boolean);

  if (partes.length === 0) {
    return (
      <span className="mt-0.5 block text-xs font-medium text-black/35">
        Sem endereço informado
      </span>
    );
  }

  return (
    <span className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-black/50">
      <MapPin className="h-3 w-3 shrink-0" />
      {partes.join(" · ")}
    </span>
  );
}

/**
 * O formulário de uma unidade. Serve para cadastrar e para editar.
 *
 * Mesmo componente nos dois casos, pelo mesmo motivo do formulário de pessoa:
 * os campos são os mesmos, e duas cópias lado a lado ficariam diferentes na
 * primeira vez que alguém mexesse em uma só. A situação (ativa ou inativa) só
 * aparece na edição — unidade nova nasce ativa, e oferecer "cadastrar já
 * inativa" seria uma pergunta sem uso.
 */
function FormularioDaUnidade({
  cliente,
  unidade,
  aoSalvar,
}: {
  cliente: ClienteDoCadastro;
  unidade: UnidadeDoCadastro | null;
  aoSalvar: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    unidade ? editarUnidade : cadastrarUnidade,
    RESULTADO_INICIAL,
  );

  const { valores, mudar } = useValores({
    nome: unidade?.nome ?? "",
    endereco: unidade?.endereco ?? "",
    cidade: unidade?.cidade ?? "",
  });
  const [ativa, setAtiva] = useState(unidade?.ativa ?? true);

  useQuandoDerCerto(estado, aoSalvar);

  return (
    <form key={estado.envio} action={executar} className="space-y-7">
      <input type="hidden" name="cliente" value={cliente.id} />
      {unidade && <input type="hidden" name="id" value={unidade.id} />}

      <div className="grid gap-6 md:grid-cols-2">
        <Campo
          nome="nome"
          etiqueta="Nome da unidade"
          obrigatorio
          exemplo="Unidade Centro"
          ajuda="Como vocês chamam este lugar. É o que aparece na hora de dizer onde cada profissional atende."
          valores={valores}
          aoMudar={mudar}
        />
        <Campo
          nome="cidade"
          etiqueta="Cidade"
          valores={valores}
          aoMudar={mudar}
        />
        <div className="md:col-span-2">
          <Campo
            nome="endereco"
            etiqueta="Endereço"
            exemplo="Rua, número, bairro"
            limite={200}
            valores={valores}
            aoMudar={mudar}
          />
        </div>
        {unidade && (
          <Status
            nome="ativa"
            etiqueta="Situação da unidade"
            palavras={["Ativa", "Inativa"]}
            ligado={ativa}
            aoMudar={setAtiva}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={enviando} className={botaoPrincipal}>
          {unidade ? (
            <Save className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {enviando
            ? unidade
              ? "Salvando…"
              : "Cadastrando…"
            : unidade
              ? "Salvar alterações"
              : "Cadastrar unidade"}
        </button>
        {unidade && <ExcluirUnidade cliente={cliente} unidade={unidade} />}
        <Aviso estado={estado} />
      </div>
    </form>
  );
}

/**
 * Exclusão em dois cliques, como a de profissional e a de cliente.
 *
 * Quem decide se dá para apagar é a ação no servidor, não este botão: ela sabe
 * se é a última unidade e se alguém atende só ali, e responde com o motivo. O
 * botão não esconde a opção nesses casos de propósito — esconder deixaria
 * "não dá para apagar" sem explicação nenhuma.
 */
function ExcluirUnidade({
  cliente,
  unidade,
}: {
  cliente: ClienteDoCadastro;
  unidade: UnidadeDoCadastro;
}) {
  const [estado, executar, enviando] = useActionState(
    excluirUnidade,
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
        Excluir {unidade.nome}?
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
          dados.set("id", String(unidade.id));
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
