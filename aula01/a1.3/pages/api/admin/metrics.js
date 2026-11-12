
import { getAdminDb } from "../../../lib/firebaseAdmin";
import { requireAdminCookie } from "../../../lib/auth";

const TIME_ZONE = "America/Sao_Paulo";

function datePartsInBrazil(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function formatISO(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}`;
}

function monthRangeISO() {
  const { year, month } = datePartsInBrazil();

  const startISO = formatISO(year, month, 1);
  const nextMonth = new Date(Date.UTC(year, month, 1));

  const endISO = formatISO(
    nextMonth.getUTCFullYear(),
    nextMonth.getUTCMonth() + 1,
    1
  );

  return { startISO, endISO };
}

function todayISO() {
  const { year, month, day } = datePartsInBrazil();
  return formatISO(year, month, day);
}

function lastSixMonths() {
  const { year, month } = datePartsInBrazil();
  const months = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(Date.UTC(year, month - 1 - i, 1));

    months.push(
      `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1
      ).padStart(2, "0")}`
    );
  }

  return months;
}

function money(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toISO(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function serializeReserva(doc) {
  const data = doc.data();

  return {
    ...data,
    _id: doc.id,
    id: doc.id,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
    entradaPagaEm: toISO(data.entradaPagaEm),
  };
}

export default async function handler(req, res) {
  const admin = requireAdminCookie(req, res);
  if (!admin) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      ok: false,
      error: "Método não permitido",
    });
  }

  try {
    const db = getAdminDb();

    const snapshot = await db.collection("reservas").get();
    const reservas = snapshot.docs.map(serializeReserva);

    const { startISO, endISO } = monthRangeISO();
    const today = todayISO();
    const months = lastSixMonths();

    // 1. Quantidade de reservas por status
    const totalReservas = reservas.length;

    const pendentes = reservas.filter(
      (r) => r.status === "PENDING"
    ).length;

    const confirmadas = reservas.filter(
      (r) => r.status === "CONFIRMED"
    ).length;

    const canceladas = reservas.filter(
      (r) => r.status === "CANCELLED"
    ).length;

    const conversao =
      totalReservas > 0 ? confirmadas / totalReservas : 0;

    // 2. Receitas confirmadas
    const reservasConfirmadas = reservas.filter(
      (r) => r.status === "CONFIRMED"
    );

    const receitaTotal = reservasConfirmadas.reduce(
      (sum, r) => sum + money(r.valorTotal),
      0
    );

    const entradasTotalConfirmadas = reservasConfirmadas.reduce(
      (sum, r) => sum + money(r.valorEntrada),
      0
    );

    const confirmadasMes = reservasConfirmadas.filter(
      (r) =>
        r.dataReserva >= startISO &&
        r.dataReserva < endISO
    );

    const receitaMes = confirmadasMes.reduce(
      (sum, r) => sum + money(r.valorTotal),
      0
    );

    const entradasMesConfirmadas = confirmadasMes.reduce(
      (sum, r) => sum + money(r.valorEntrada),
      0
    );

    // 3. Pendências
    const reservasPendentes = reservas.filter(
      (r) => r.status === "PENDING"
    );

    const receitaPendente = reservasPendentes.reduce(
      (sum, r) => sum + money(r.valorTotal),
      0
    );

    const entradasPendentesTotal = reservasPendentes.reduce(
      (sum, r) => sum + money(r.valorEntrada),
      0
    );

    const entradasPendentesNaoPagas = reservasPendentes
      .filter((r) => r.entradaPaga === false)
      .reduce(
        (sum, r) => sum + money(r.valorEntrada),
        0
      );

    // 4. Entradas efetivamente marcadas como pagas
    const entradasPagas = reservas
      .filter((r) => r.entradaPaga === true)
      .reduce(
        (sum, r) => sum + money(r.valorEntrada),
        0
      );

    // 5. Próximas reservas
    const proximasBase = reservas
      .filter(
        (r) =>
          ["PENDING", "CONFIRMED"].includes(r.status) &&
          r.dataReserva >= today
      )
      .sort((a, b) =>
        a.dataReserva.localeCompare(b.dataReserva)
      )
      .slice(0, 10);

    const proximas = await Promise.all(
      proximasBase.map(async (reserva) => {
        let cliente = null;

        if (reserva.customerId) {
          const clienteDoc = await db
            .collection("clientes")
            .doc(String(reserva.customerId))
            .get();

          if (clienteDoc.exists) {
            const data = clienteDoc.data();

            cliente = {
              _id: clienteDoc.id,
              id: clienteDoc.id,
              nome: data.nome,
              whatsapp: data.whatsapp,
              email: data.email,
            };
          }
        }

        return {
          ...reserva,
          customerId: cliente,
        };
      })
    );

    // 6. Reservas dos últimos seis meses
    const reservasPorMes = months.map((month) => ({
      month,
      total: reservas.filter(
        (r) =>
          typeof r.dataReserva === "string" &&
          r.dataReserva.startsWith(month)
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
  } catch (error) {
    console.error("ERRO METRICS FIREBASE:", error);

    return res.status(500).json({
      ok: false,
      error: "Erro ao gerar métricas.",
    });
  }
}
