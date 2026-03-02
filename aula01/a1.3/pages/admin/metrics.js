// pages/api/admin/metrics.js
import { dbConnect } from "../../../lib/mongodb";
import Reserva from "../../../models/Reserva";
import { COOKIE_NAME, verifyToken } from "../../../lib/auth";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function monthStartISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function nextMonthStartISO(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    await dbConnect();

    // 🔐 Verificação de admin via cookie
    const token = req.cookies?.[COOKIE_NAME];
    const payload = token ? verifyToken(token) : null;

    if (!payload || payload.role !== "admin") {
      return res.status(401).json({ ok: false, error: "Não autorizado" });
    }

    // =============================
    // 1️⃣ CONTAGEM POR STATUS
    // =============================
    const statusAgg = await Reserva.aggregate([
      { $group: { _id: "$status", total: { $sum: 1 } } },
    ]);

    const statusMap = statusAgg.reduce((acc, cur) => {
      acc[cur._id] = cur.total;
      return acc;
    }, {});

    const totalReservas =
      Object.values(statusMap).reduce((a, b) => a + b, 0) || 0;

    const pendentes = statusMap.PENDING || 0;
    const confirmadas = statusMap.CONFIRMED || 0;
    const canceladas = statusMap.CANCELLED || 0;

    const conversao =
      totalReservas > 0 ? confirmadas / totalReservas : 0;

    // =============================
    // 2️⃣ RECEITA CONFIRMADA TOTAL
    // =============================
    const receitaTotalAgg = await Reserva.aggregate([
      { $match: { status: "CONFIRMED" } },
      {
        $group: {
          _id: null,
          receitaTotal: { $sum: { $ifNull: ["$valorTotal", 0] } },
          entradasTotalConfirmadas: {
            $sum: { $ifNull: ["$valorEntrada", 0] },
          },
        },
      },
    ]);

    const receitaTotal = receitaTotalAgg?.[0]?.receitaTotal || 0;
    const entradasTotalConfirmadas =
      receitaTotalAgg?.[0]?.entradasTotalConfirmadas || 0;

    // =============================
    // 3️⃣ RECEITA DO MÊS
    // =============================
    const now = new Date();
    const startISO = monthStartISO(now);
    const endISO = nextMonthStartISO(now);

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
          receitaMes: { $sum: { $ifNull: ["$valorTotal", 0] } },
          entradasMesConfirmadas: {
            $sum: { $ifNull: ["$valorEntrada", 0] },
          },
        },
      },
    ]);

    const receitaMes = receitaMesAgg?.[0]?.receitaMes || 0;
    const entradasMesConfirmadas =
      receitaMesAgg?.[0]?.entradasMesConfirmadas || 0;

    // =============================
    // 4️⃣ PENDÊNCIAS
    // =============================
    const pendenciasAgg = await Reserva.aggregate([
      { $match: { status: "PENDING" } },
      {
        $group: {
          _id: null,
          receitaPendente: {
            $sum: { $ifNull: ["$valorTotal", 0] },
          },
          entradasPendentesTotal: {
            $sum: { $ifNull: ["$valorEntrada", 0] },
          },
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

    const receitaPendente =
      pendenciasAgg?.[0]?.receitaPendente || 0;
    const entradasPendentesTotal =
      pendenciasAgg?.[0]?.entradasPendentesTotal || 0;
    const entradasPendentesNaoPagas =
      pendenciasAgg?.[0]?.entradasPendentesNaoPagas || 0;

    // =============================
    // 5️⃣ ENTRADAS PAGAS
    // =============================
    const entradasPagasAgg = await Reserva.aggregate([
      { $match: { entradaPaga: true } },
      {
        $group: {
          _id: null,
          entradasPagas: {
            $sum: { $ifNull: ["$valorEntrada", 0] },
          },
        },
      },
    ]);

    const entradasPagas =
      entradasPagasAgg?.[0]?.entradasPagas || 0;

    // =============================
    // 6️⃣ PRÓXIMAS RESERVAS
    // =============================
    const today = todayISO();

    const proximas = await Reserva.find({
      status: { $in: ["PENDING", "CONFIRMED"] },
      dataReserva: { $gte: today },
    })
      .sort({ dataReserva: 1 })
      .limit(10)
      .populate("customerId", "nome whatsapp email")
      .lean();

    // =============================
    // 7️⃣ ÚLTIMOS 6 MESES
    // =============================
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      );
    }

    const seriesAgg = await Reserva.aggregate([
      { $addFields: { ym: { $substr: ["$dataReserva", 0, 7] } } },
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
    console.error("ERRO METRICS:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao gerar métricas",
    });
  }
}