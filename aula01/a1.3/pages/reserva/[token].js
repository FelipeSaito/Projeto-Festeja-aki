// pages/reserva/[token].js
// PÁGINA PÚBLICA: acompanhamento da reserva pelo cliente.
// O acesso é pelo código secreto da reserva (tokenAcompanhamento).
// Os dados são buscados no servidor; nada de WhatsApp, e-mail ou IDs chega ao navegador.
import Head from "next/head";
import Link from "next/link";
import styles from "../../styles/Calendar.module.css";

const TIME_ZONE = "America/Sao_Paulo";

// "2026-11-21" -> "sábado, 21 de novembro de 2026"
function dataPorExtenso(dataISO) {
  const [ano, mes, dia] = String(dataISO || "").split("-").map(Number);
  if (!ano || !mes || !dia) return String(dataISO || "");

  return new Date(Date.UTC(ano, mes - 1, dia)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ISO -> "17/11 às 19:30" (horário de São Paulo)
function prazoPorExtenso(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";

  const dia = d.toLocaleDateString("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  });
  const hora = d.toLocaleTimeString("pt-BR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dia} às ${hora}`;
}

function moneyBR(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export async function getServerSideProps({ params, res }) {
  // Página pessoal: não guardar em cache, não indexar, não vazar o link em cliques
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");

  // Import dinâmico: o serviço usa o Firebase Admin e só pode rodar no servidor
  const { buscarAcompanhamento } = await import("../../lib/reservasService");

  let dados = null;

  try {
    dados = await buscarAcompanhamento(String(params?.token || ""));
  } catch (err) {
    console.error("Erro ao carregar acompanhamento.", err?.message || err);
    return { props: { erro: true } };
  }

  if (!dados) return { notFound: true };

  // Opcional: número do salão (só dígitos, com 55) para o botão de contato.
  // Sem a variável, o botão simplesmente não aparece.
  const whatsappSalao = String(process.env.WHATSAPP_SALAO || "").replace(/\D/g, "");

  // Textos já formatados no servidor, para o navegador mostrar exatamente o mesmo
  return {
    props: {
      erro: false,
      reserva: {
        primeiroNome: dados.primeiroNome,
        situacao: dados.situacao,
        data: dataPorExtenso(dados.dataReserva),
        horario: `${dados.horarioInicio} - ${dados.horarioFim}`,
        valorTotal: moneyBR(dados.valorTotal),
        valorEntrada: moneyBR(dados.valorEntrada),
        valorRestante: moneyBR(dados.valorRestante),
        entradaPaga: dados.entradaPaga,
        prazo: prazoPorExtenso(dados.expiraEm),
      },
      whatsappSalao,
    },
  };
}

// Título, texto e cor de cada situação
function conteudoDaSituacao(reserva) {
  switch (reserva.situacao) {
    case "AGUARDANDO_SINAL":
      return {
        selo: "Aguardando o sinal",
        cor: "#b45309",
        fundo: "#fef3c7",
        texto: reserva.prazo
          ? `A data está guardada para você. Para confirmar, pague o sinal de ${reserva.valorEntrada} dentro do prazo. Depois dele, a data volta a ficar disponível.`
          : `A data está guardada para você. Para confirmar, falta o sinal de ${reserva.valorEntrada}.`,
      };

    case "SINAL_RECEBIDO":
      return {
        selo: "Sinal recebido",
        cor: "#1d4ed8",
        fundo: "#dbeafe",
        texto: "Recebemos o seu sinal. Falta só a confirmação final do salão, que sai em breve.",
      };

    case "CONFIRMADA":
      return {
        selo: "Reserva confirmada",
        cor: "#15803d",
        fundo: "#dcfce7",
        texto: `Está tudo certo: a data é sua. O restante de ${reserva.valorRestante} é combinado direto com o salão.`,
      };

    case "SALAO_PRONTO":
      return {
        selo: "Salão pronto para a sua festa",
        cor: "#15803d",
        fundo: "#dcfce7",
        texto: `O salão já está limpo e preparado. Esperamos você no dia da festa! O restante de ${reserva.valorRestante} é combinado direto com o salão.`,
      };

    case "REALIZADA":
      return {
        selo: "Festa realizada",
        cor: "#15803d",
        fundo: "#dcfce7",
        texto: "Obrigado por festejar com a gente! Quando quiser, é só escolher uma nova data.",
      };

    case "PRAZO_ENCERRADO":
      return {
        selo: "Prazo do sinal encerrado",
        cor: "#b91c1c",
        fundo: "#fee2e2",
        texto: "O prazo para pagar o sinal terminou e a data voltou a ficar disponível. Se ainda quiser a data, faça um novo pedido ou fale com o salão.",
      };

    default:
      return {
        selo: "Reserva cancelada",
        cor: "#b91c1c",
        fundo: "#fee2e2",
        texto: "Esta reserva foi cancelada. Se quiser, escolha outra data no calendário.",
      };
  }
}

export default function AcompanhamentoPage({ erro, reserva, whatsappSalao }) {
  const cabecalho = (
    <Head>
      <title>Minha reserva | Festeja Aki</title>
      <meta name="robots" content="noindex, nofollow" />
      <meta name="referrer" content="no-referrer" />
    </Head>
  );

  if (erro || !reserva) {
    return (
      <main className={styles.page}>
        {cabecalho}
        <div className={styles.top} style={{ textAlign: "center" }}>
          <h1 className={styles.title}>Minha reserva</h1>
          <p className={styles.subtitle}>
            Não foi possível carregar a reserva agora. Tente de novo em alguns minutos.
          </p>
        </div>
      </main>
    );
  }

  const situacao = conteudoDaSituacao(reserva);
  const ativa = ["AGUARDANDO_SINAL", "SINAL_RECEBIDO", "CONFIRMADA", "SALAO_PRONTO"].includes(
    reserva.situacao
  );
  const mostrarCalendario = ["PRAZO_ENCERRADO", "CANCELADA", "REALIZADA"].includes(
    reserva.situacao
  );

  const linkSalao = whatsappSalao
    ? `https://wa.me/${whatsappSalao}?text=${encodeURIComponent(
        `Olá! Quero falar sobre a minha reserva de ${reserva.data}.`
      )}`
    : "";

  return (
    <main className={styles.page}>
      {cabecalho}

      <div className={styles.top} style={{ textAlign: "center" }}>
        <h1 className={styles.title}>Minha reserva</h1>
        <p className={styles.subtitle}>
          {reserva.primeiroNome ? `Olá, ${reserva.primeiroNome}! ` : ""}
          Aqui você acompanha a situação da sua reserva no Festeja Aki.
        </p>
      </div>

      <section className={styles.card} style={{ maxWidth: 560, margin: "0 auto" }}>
        <p
          role="status"
          style={{
            display: "inline-block",
            margin: "0 0 12px",
            padding: "6px 14px",
            borderRadius: 999,
            fontWeight: 700,
            color: situacao.cor,
            background: situacao.fundo,
          }}
        >
          {situacao.selo}
        </p>

        <p className={styles.hint}>{situacao.texto}</p>

        {reserva.situacao === "AGUARDANDO_SINAL" && reserva.prazo && (
          <p style={{ margin: "12px 0", fontSize: "1.05rem" }}>
            Pagar o sinal até: <strong style={{ color: "#f59e0b" }}>{reserva.prazo}</strong>
          </p>
        )}

        <div className={styles.summary}>
          <div>
            <span>Data:</span> <strong>{reserva.data}</strong>
          </div>
          <div>
            <span>Horário:</span> <strong>{reserva.horario}</strong>
          </div>

          {ativa && (
            <>
              <div>
                <span>Valor total:</span> <strong>{reserva.valorTotal}</strong>
              </div>
              <div>
                <span>Sinal:</span>{" "}
                <strong>
                  {reserva.valorEntrada} {reserva.entradaPaga ? "(pago)" : "(a pagar)"}
                </strong>
              </div>
              <div>
                <span>Restante:</span> <strong>{reserva.valorRestante}</strong>
              </div>
            </>
          )}
        </div>

        {linkSalao && (
          <a
            href={linkSalao}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cta}
            style={{ display: "block", textAlign: "center", textDecoration: "none" }}
          >
            Falar com o salão no WhatsApp
          </a>
        )}

        {mostrarCalendario && (
          <div className={styles.backRow} style={{ marginTop: 12 }}>
            <Link href="/calendario" className={styles.backLink}>
              Ver datas disponíveis
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}