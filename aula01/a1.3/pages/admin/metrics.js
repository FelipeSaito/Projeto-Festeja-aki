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
    const todayISO = new Date();
    const yyyy = todayISO.getFullYear();
    const mm = String(todayISO.getMonth() + 1).padStart(2, "0");
    const dd = String(todayISO.getDate()).padStart(2, "0");
    const today = `${yyyy}-${mm}-${dd}`;

    // 1) Contadores por status
    const statusAgg = await Reserva.aggregate([
      { $group: { _id: "$status", total: { $sum: 1 } } },
    ]);

    const statusMap = statusAgg.reduce((acc, cur) => {
      acc[cur._id || "UNKNOWN"] = cur.total;
      return acc;
    }, {});

    const totalReservas =
      Object.values(statusMap).reduce((a, b) => a + b, 0) || 0;

    const pendentes = statusMap.PENDING || 0;
    const confirmadas = statusMap.CONFIRMED || 0;
    const canceladas = statusMap.CANCELLED || 0;

    // 2) Receita total (somente CONFIRMED)
    const receitaTotalAgg = await Reserva.aggregate([
      { $match: { status: "CONFIRMED" } },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$valorTotal", 0] } },
          entrada: { $sum: { $ifNull: ["$valorEntrada", 0] } },
        },
      },
    ]);

    const receitaTotal = receitaTotalAgg?.[0]?.total || 0;
    const entradasTotal = receitaTotalAgg?.[0]?.entrada || 0;

    // 3) Receita mês atual (somente CONFIRMED)
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
          entrada: { $sum: { $ifNull: ["$valorEntrada", 0] } },
        },
      },
    ]);

    const receitaMes = receitaMesAgg?.[0]?.total || 0;
    const entradasMes = receitaMesAgg?.[0]?.entrada || 0;

    // 4) Próximas reservas confirmadas (top 8)
    // (assumindo dataReserva "YYYY-MM-DD")
    const proximas = await Reserva.find({
      status: "CONFIRMED",
      dataReserva: { $gte: today },
    })
      .sort({ dataReserva: 1 })
      .limit(8)
      .populate("customerId", "nome whatsapp email")
      .lean();

    // 5) Série simples: reservas por mês (últimos 6 meses) — opcional
    // se preferir, dá pra tirar. aqui vai por "YYYY-MM"
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push(key);
    }

    const seriesAgg = await Reserva.aggregate([
      {
        $addFields: {
          ym: { $substr: ["$dataReserva", 0, 7] }, // "YYYY-MM"
        },
      },
      { $match: { ym: { $in: months } } },
      { $group: { _id: "$ym", total: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const seriesMap = seriesAgg.reduce((acc, cur) => {
      acc[cur._id] = cur.total;
      return acc;
    }, {});

    const reservasPorMes = months.map((m) => ({
      month: m,
      total: seriesMap[m] || 0,
    }));

    return res.json({
      ok: true,
      data: {
        totalReservas,
        pendentes,
        confirmadas,
        canceladas,
        receitaTotal,
        entradasTotal,
        receitaMes,
        entradasMes,
        proximas,
        reservasPorMes,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Erro ao gerar métricas" });
  }
}