// pages/api/admin/metrics.js
import { dbConnect } from "../../../lib/mongodb";
import Reserva from "../../../models/Reserva";
import { COOKIE_NAME, verifyToken } from "../../../lib/auth";

function monthRangeISO(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-11
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 1);
  const toISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return { startISO: toISO(start), endISO: toISO(end) };
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default async function handler(req, res) {
  await dbConnect();

  // 🔐 auth via cookie admin
  const token = req.cookies?.[COOKIE_NAME];
  const payload = token ? verifyToken(token) : null;

  if (!payload || payload.role !== "admin") {
    return res.status(401).json({ ok: false, error: "Não autorizado" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { startISO, endISO } = monthRangeISO(new Date());
    const today = todayISO();

    // 1) Contadores por status
    const statusAgg = await Reserva.aggregate([
      { $group: { _id: "$status", total: { $sum: 1 } } },
    ]);

    const statusMap = statusAgg.reduce((acc, cur) => {
      acc[cur._id || "UNKNOWN"] = cur.total;
      return acc;
    }, {});

    const totalReservas = Object.values(statusMap).reduce((a, b) => a + b, 0) || 0;
    const pendentes = statusMap.PENDING || 0;
    const confirmadas = statusMap.CONFIRMED || 0;
    const canceladas = statusMap.CANCELLED || 0;

    const conversao = totalReservas > 0 ? (confirmadas / totalReservas) : 0;

    // 2) Receitas (CONFIRMED)
    const receitaTotalAgg = await Reserva.aggregate([
      { $match: { status: "CONFIRMED" } },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$valorTotal", 0] } },
          entradas: { $sum: { $ifNull: ["$valorEntrada", 0] } },
        },
      },
    ]);

    const receitaTotal = receitaTotalAgg?.[0]?.total || 0;
    const entradasTotalConfirmadas = receitaTotalAgg?.[0]?.entradas || 0;

    const receitaMesAgg = await Reserva.aggregate([
      {
        $match: {
          status: "CONFIRMED",
          dataReserva: { $gte: startISO, $lt: endISO },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$valorTotal", 0] } },
          entradas: { $sum: { $ifNull: ["$valorEntrada", 0] } },
        },
      },
    ]);

    const receitaMes = receitaMesAgg?.[0]?.total || 0;
    const entradasMesConfirmadas = receitaMesAgg?.[0]?.entradas || 0;

    // 3) PENDÊNCIAS (PENDING)
    const pendenciasAgg = await Reserva.aggregate([
      { $match: { status: "PENDING" } },
      {
        $group: {
          _id: null,
          receitaPendente: { $sum: { $ifNull: ["$valorTotal", 0] } },
          entradasPendentesTotal: { $sum: { $ifNull: ["$valorEntrada", 0] } },
          entradasPendentesNaoPagas: {
            $sum: {
              $cond: [
                { $eq: ["$entradaPaga", false] },
                { $ifNull: ["$valorEntrada", 0] },
                0,
              ],
            },
          },
        },
      },
    ]);

    const receitaPendente = pendenciasAgg?.[0]?.receitaPendente || 0;
    const entradasPendentesTotal = pendenciasAgg?.[0]?.entradasPendentesTotal || 0;
    const entradasPendentesNaoPagas = pendenciasAgg?.[0]?.entradasPendentesNaoPagas || 0;

    // 4) Entradas pagas (em qualquer status)
    const entradasPagasAgg = await Reserva.aggregate([
      { $match: { entradaPaga: true } },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$valorEntrada", 0] } },
        },
      },
    ]);

    const entradasPagas = entradasPagasAgg?.[0]?.total || 0;

    // 5) Próximas reservas (PENDING + CONFIRMED)
    const proximas = await Reserva.find({
      status: { $in: ["PENDING", "CONFIRMED"] },
      dataReserva: { $gte: today },
    })
      .sort({ dataReserva: 1 })
      .limit(10)
      .populate("customerId", "nome whatsapp email")
      .lean();

    // 6) Série: reservas por mês (últimos 6 meses)
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push(key);
    }

    const seriesAgg = await Reserva.aggregate([
      { $addFields: { ym: { $substr: ["$dataReserva", 0, 7] } } }, // "YYYY-MM"
      { $match: { ym: { $in: months } } },
      { $group: { _id: "$ym", total: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const seriesMap = seriesAgg.reduce((acc, cur) => {
      acc[cur._id] = cur.total;
      return acc;
    }, {});

    const reservasPorMes = months.map((m) => ({ month: m, total: seriesMap[m] || 0 }));

    return res.json({
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
    console.error(err);
    return res.status(500).json({ ok: false, error: "Erro ao gerar métricas" });
  }
}