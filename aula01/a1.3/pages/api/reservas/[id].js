import { dbConnect } from "../../../lib/mongodb";
import Reserva from "../../../models/Reserva";
import Customer from "../../../models/Customer";

function requireAdmin(req, res) {
  const key = req.headers["x-admin-key"];
  if (!key || key !== process.env.ADMIN_KEY) {
    res.status(401).json({ ok: false, error: "Não autorizado (admin)" });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  await dbConnect();

  const { id } = req.query;

  // ✅ só admin pode confirmar/cancelar
  if (!requireAdmin(req, res)) return;

  if (req.method === "PATCH") {
    try {
      const { action } = req.body; // "confirm" | "cancel"

      let nextStatus = null;
      if (action === "confirm") nextStatus = "CONFIRMED";
      if (action === "cancel") nextStatus = "CANCELLED";

      if (!nextStatus) {
        return res.status(400).json({ ok: false, error: "action inválida (use confirm/cancel)" });
      }

      const reserva = await Reserva.findByIdAndUpdate(
        id,
        { status: nextStatus },
        { new: true }
      );

      if (!reserva) return res.status(404).json({ ok: false, error: "Reserva não encontrada" });

      return res.status(200).json({ ok: true, reserva });
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(409).json({ ok: false, error: "Já existe reserva ativa nessa data." });
      }
      return res.status(500).json({ ok: false, error: "Erro interno", details: String(err?.message || err) });
    }
  }

  return res.status(405).json({ ok: false, error: "Método não permitido" });
}