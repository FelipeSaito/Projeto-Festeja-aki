// pages/api/admin/metrics.js
// API ADMIN: indicadores do painel. O formato da resposta deve ser preservado.
import { requireAdminCookie } from "../../../lib/auth";
import {
  listarReservas,
  todayInBrazil,
  responderErro,
  STATUS,
} from "../../../lib/reservasService";

function money(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function soma(lista, campo) {
  return lista.reduce((total, r) => total + money(r[campo]), 0);
}

// "YYYY-MM" do mês atual e dos 5 anteriores (fuso de São Paulo)
function ultimosSeisMeses(hojeISO) {
  const [year, month] = hojeISO.split("-").map(Number);
  const meses = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    meses.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  return meses;
}

export default async function handler(req, res) {
  const admin = requireAdminCookie(req, res);
  if (!admin) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  try {
    const reservas = await listarReservas();

    const hoje = todayInBrazil();
    const mesAtual = hoje.slice(0, 7); // "YYYY-MM"
    const meses = ultimosSeisMeses(hoje);

    const pendentesLista = reservas.filter((r) => r.status === STATUS.PENDING);
    const confirmadasLista = reservas.filter((r) => r.status === STATUS.CONFIRMED);
    const canceladasLista = reservas.filter((r) => r.status === STATUS.CANCELLED);

    const confirmadasMes = confirmadasLista.filter(
      (r) => typeof r.dataReserva === "string" && r.dataReserva.startsWith(mesAtual)
    );

    // 1. Quantidades
    const totalReservas = reservas.length;
    const pendentes = pendentesLista.length;
    const confirmadas = confirmadasLista.length;
    const canceladas = canceladasLista.length;
    const conversao = totalReservas > 0 ? confirmadas / totalReservas : 0;

    // 2. Receitas confirmadas
    const receitaTotal = soma(confirmadasLista, "valorTotal");
    const receitaMes = soma(confirmadasMes, "valorTotal");
    const entradasTotalConfirmadas = soma(confirmadasLista, "valorEntrada");
    const entradasMesConfirmadas = soma(confirmadasMes, "valorEntrada");

    // 3. Pendências
    const receitaPendente = soma(pendentesLista, "valorTotal");
    const entradasPendentesTotal = soma(pendentesLista, "valorEntrada");
    const entradasPendentesNaoPagas = soma(
      pendentesLista.filter((r) => r.entradaPaga === false),
      "valorEntrada"
    );

    // 4. Entradas efetivamente marcadas como pagas
    const entradasPagas = soma(
      reservas.filter((r) => r.entradaPaga === true),
      "valorEntrada"
    );

    // 5. Próximas reservas ativas (já com o cliente em customerId)
    const proximas = reservas
      .filter(
        (r) =>
          [STATUS.PENDING, STATUS.CONFIRMED].includes(r.status) &&
          typeof r.dataReserva === "string" &&
          r.dataReserva >= hoje
      )
      .sort((a, b) => a.dataReserva.localeCompare(b.dataReserva))
      .slice(0, 10);

    // 6. Reservas por mês (últimos seis meses)
    const reservasPorMes = meses.map((month) => ({
      month,
      total: reservas.filter(
        (r) => typeof r.dataReserva === "string" && r.dataReserva.startsWith(month)
      ).length,
    }));

    return res.status(200).json({
      ok: true,
      data: {
        totalReservas,
        pendentes,
        confirmadas,
        canceladas,
        conversao,

        receitaTotal,
        receitaMes,
        receitaPendente,

        entradasPagas,
        entradasTotalConfirmadas,
        entradasMesConfirmadas,

        entradasPendentesTotal,
        entradasPendentesNaoPagas,

        proximas,
        reservasPorMes,
      },
    });
  } catch (err) {
    return responderErro(res, err, "Erro ao gerar métricas.");
  }
}