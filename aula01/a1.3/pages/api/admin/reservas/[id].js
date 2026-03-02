// pages/api/admin/reservas/[id].js
import { dbConnect } from "../../../../lib/mongodb";
import Reserva from "../../../../models/Reserva";
import { COOKIE_NAME, verifyToken } from "../../../../lib/auth";

export default async function handler(req, res) {
  await dbConnect();

  // 🔐 auth via cookie admin
  const token = req.cookies?.[COOKIE_NAME];
  const payload = token ? verifyToken(token) : null;

  if (!payload || payload.role !== "admin") {
    return res.status(401).json({ ok: false, error: "Não autorizado" });
  }

  const { id } = req.query;

  if (req.method !== "PATCH") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { action } = req.body || {};

    const reserva = await Reserva.findById(id);
    if (!reserva) {
      return res.status(404).json({ ok: false, error: "Reserva não encontrada" });
    }

    // ✅ Actions existentes (exemplo)
    if (action === "CONFIRM") {
      reserva.status = "CONFIRMED";
    }

    if (action === "CANCEL") {
      reserva.status = "CANCELLED";
    }

    // ✅ NOVO: marcar entrada como paga
    if (action === "MARK_ENTRY_PAID") {
      reserva.entradaPaga = true;
      reserva.entradaPagaEm = new Date();
    }

    // ✅ OPCIONAL: desmarcar entrada paga
    if (action === "UNMARK_ENTRY_PAID") {
      reserva.entradaPaga = false;
      reserva.entradaPagaEm = null;
    }

    await reserva.save();

    return res.json({ ok: true, reserva });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Erro ao atualizar reserva" });
  }
}