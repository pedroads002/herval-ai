import Link from "next/link";
import { Building2, ChevronRight, User } from "lucide-react";
import type { ClienteDoCadastro } from "@/lib/dados/profissionais";

/**
 * A lista de clientes atendidos pela Helô.
 *
 * Antes esta tela listava profissionais soltos, sem dizer de quem eles eram.
 * Agora a linha é o cliente — que é a entidade-pai do cadastro — e quem atende
 * nele aparece ao abrir. Um profissional só existe dentro de um cliente, e uma
 * lista que não mostrava isso obrigava a decorar quem trabalhava onde.
 *
 * Não recebe o dado por conta própria: quem lê o banco é a página, que é
 * componente de servidor.
 */
export default function TabelaClientes({
  clientes,
  falha,
}: {
  clientes: ClienteDoCadastro[];
  falha: string | null;
}) {
  /**
   * Falha de leitura não é lista vazia. Sem esta distinção, banco fora do ar e
   * cadastro realmente vazio viram a mesma tela em branco — e a primeira é
   * defeito, que alguém leria como "não tem ninguém cadastrado".
   */
  if (falha) {
    return (
      <div className="rounded-card border border-herval-vermelho/30 bg-herval-vermelho/5 px-5 py-6">
        <p className="text-sm font-bold text-herval-preto">
          Não deu para carregar os clientes.
        </p>
        <p className="mt-1 text-sm font-medium text-black/60">{falha}</p>
      </div>
    );
  }

  const profissionais = clientes.reduce(
    (total, cliente) => total + cliente.profissionais.length,
    0,
  );

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-black/55">
        <span className="font-extrabold text-herval-preto">
          {clientes.length}
        </span>{" "}
        {clientes.length === 1 ? "cliente" : "clientes"} ·{" "}
        <span className="font-extrabold text-herval-preto">
          {profissionais}
        </span>{" "}
        {profissionais === 1 ? "profissional" : "profissionais"}.
      </p>

      {clientes.length === 0 ? (
        <Vazio />
      ) : (
        <>
          {/*
            Duas formas do mesmo dado, uma por largura de tela. A tabela precisa
            de 820px para as seis colunas caberem; num celular de 390px isso
            vira rolagem lateral obrigatória para ler uma linha inteira. Abaixo
            de `md` cada cliente vira um cartão empilhado, com o rótulo junto do
            valor. De `md` para cima a tabela é exatamente a de antes.
          */}
          <div className="space-y-3 md:hidden">
            {clientes.map((cliente) => (
              <Cartao key={cliente.id} cliente={cliente} />
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-card border border-black/10 bg-herval-branco shadow-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b border-black/10 bg-black/[0.03] text-left text-xs uppercase tracking-wider text-black/50">
                  <tr>
                    <th className="px-6 py-4 font-bold">Cliente</th>
                    <th className="px-6 py-4 font-bold">Como funciona</th>
                    <th className="px-6 py-4 font-bold">Área de atuação</th>
                    <th className="px-6 py-4 font-bold">Onde atende</th>
                    <th className="px-6 py-4 font-bold">Profissionais</th>
                    <th className="px-6 py-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.07]">
                  {clientes.map((cliente) => (
                    <Linha key={cliente.id} cliente={cliente} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Os dados que a linha calcula a partir do cliente. Ficam numa função só para
 * a versão de celular não poder divergir da de computador — é o mesmo cliente,
 * visto em duas larguras de tela.
 */
function resumo(cliente: ClienteDoCadastro) {
  return {
    individual: cliente.tipoOperacao === "individual",
    ativos: cliente.profissionais.filter((p) => p.ativo).length,
    lugar: [cliente.cidade, cliente.estado].filter(Boolean).join(" · "),
  };
}

function Linha({ cliente }: { cliente: ClienteDoCadastro }) {
  const { individual, ativos, lugar } = resumo(cliente);

  return (
    <tr className="transition-colors hover:bg-herval-verde/[0.06]">
      {/* A linha inteira é um destino: o link ocupa a primeira célula e as
          outras acompanham o hover. Célula clicável isolada obrigaria a mirar
          no nome, que é o alvo mais estreito da linha. */}
      <td className="px-6 py-5">
        <Link href={`/clientes/${cliente.id}`} className="block">
          <span className="block font-bold text-herval-preto">
            {cliente.nome}
          </span>
          {(cliente.nomeExibicao || cliente.responsavelPrincipal) && (
            <span className="mt-0.5 block text-xs font-medium text-black/50">
              {individual
                ? cliente.nomeExibicao
                : `Responsável: ${cliente.responsavelPrincipal}`}
            </span>
          )}
          {!cliente.ativa && (
            <span className="mt-1.5 inline-block rounded-full border border-black/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black/45">
              Inativo
            </span>
          )}
        </Link>
      </td>

      <td className="px-6 py-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-black/20 px-3 py-1 text-xs font-bold text-black/65">
          {individual ? (
            <User className="h-3.5 w-3.5" />
          ) : (
            <Building2 className="h-3.5 w-3.5" />
          )}
          {individual ? "Profissional individual" : "Clínica ou equipe"}
        </span>
      </td>

      <td className="px-6 py-5 text-black/65">
        {cliente.areaAtuacao || (
          <span className="text-xs font-medium text-black/35">
            Não informada
          </span>
        )}
      </td>

      <td className="px-6 py-5 text-black/65">
        {lugar || (
          <span className="text-xs font-medium text-black/35">
            Não informado
          </span>
        )}
      </td>

      <td className="px-6 py-5 text-black/65">
        {cliente.profissionais.length === 0 ? (
          <span className="text-xs font-medium text-black/35">Ninguém</span>
        ) : (
          <>
            {cliente.profissionais.length}
            {/* Quantos estão inativos importa: um cliente com três pessoas e
                nenhuma ativa não atende ninguém, e o número sozinho esconde
                isso. */}
            {ativos < cliente.profissionais.length && (
              <span className="ml-1.5 text-xs font-medium text-black/45">
                ({ativos} {ativos === 1 ? "ativo" : "ativos"})
              </span>
            )}
          </>
        )}
      </td>

      <td className="px-6 py-5 text-right">
        <Link
          href={`/clientes/${cliente.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
        >
          Abrir
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </td>
    </tr>
  );
}

/**
 * O mesmo cliente da `Linha`, empilhado. Nenhuma informação sai: o que era
 * coluna vira par rótulo/valor, porque no celular não há cabeçalho de tabela
 * para explicar o que o número significa.
 */
function Cartao({ cliente }: { cliente: ClienteDoCadastro }) {
  const { individual, ativos, lugar } = resumo(cliente);

  return (
    <Link
      href={`/clientes/${cliente.id}`}
      className="block rounded-card border border-black/10 bg-herval-branco p-4 shadow-card transition-colors active:bg-herval-verde/[0.06]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block font-bold text-herval-preto">
            {cliente.nome}
          </span>
          {(cliente.nomeExibicao || cliente.responsavelPrincipal) && (
            <span className="mt-0.5 block text-xs font-medium text-black/50">
              {individual
                ? cliente.nomeExibicao
                : `Responsável: ${cliente.responsavelPrincipal}`}
            </span>
          )}
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-black/35" />
      </div>

      {!cliente.ativa && (
        <span className="mt-2 inline-block rounded-full border border-black/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black/45">
          Inativo
        </span>
      )}

      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-black/20 px-3 py-1 text-xs font-bold text-black/65">
        {individual ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Building2 className="h-3.5 w-3.5" />
        )}
        {individual ? "Profissional individual" : "Clínica ou equipe"}
      </span>

      <dl className="mt-3 space-y-1.5 text-sm">
        <Campo rotulo="Área de atuação" valor={cliente.areaAtuacao} />
        <Campo rotulo="Onde atende" valor={lugar} />
        <Campo
          rotulo="Profissionais"
          vazio="Ninguém"
          valor={
            cliente.profissionais.length === 0
              ? ""
              : ativos < cliente.profissionais.length
                ? `${cliente.profissionais.length} (${ativos} ${ativos === 1 ? "ativo" : "ativos"})`
                : String(cliente.profissionais.length)
          }
        />
      </dl>
    </Link>
  );
}

function Campo({
  rotulo,
  valor,
  vazio = "Não informado",
}: {
  rotulo: string;
  valor: string;
  vazio?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs font-bold uppercase tracking-wide text-black/45">
        {rotulo}
      </dt>
      <dd className="min-w-0 text-right font-medium text-black/65">
        {valor || (
          <span className="text-xs font-medium text-black/35">{vazio}</span>
        )}
      </dd>
    </div>
  );
}

function Vazio() {
  return (
    <div className="rounded-card border border-dashed border-black/15 bg-herval-branco px-6 py-14 text-center">
      <p className="text-sm font-bold text-herval-preto">
        Nenhum cliente cadastrado ainda.
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium text-black/55">
        Comece pelo botão acima. A primeira pergunta é se o cliente atende
        sozinho ou tem uma equipe — o resto do formulário muda a partir dela.
      </p>
    </div>
  );
}
