// pages/api/admin/reservas/[id].js
// API ADMIN: confirmar, cancelar, marcar/desmarcar entrada paga.
import { requireAdminCookie } from "../../../../lib/auth";
import { atualizarReserva, responderErro } from "../../../../lib/reservasService";

export default async function handler(req, res) {
  const admin = requireAdminCookie(req, res);
  if (!admin) return;

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  try {
    const { id } = req.query;
    const { action } = req.body || {};

    const reserva = await atualizarReserva(id, action);
    return res.status(200).json({ ok: true, reserva });
  } catch (err) {
    return responderErro(res, err, "Erro ao atualizar reserva.");
  }
}