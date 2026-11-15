// pages/api/admin/reservas/[id].js
// API ADMIN: confirmar, cancelar, marcar/desmarcar entrada paga (PATCH)
// e excluir definitivamente uma reserva cancelada (DELETE).
import { requireAdminCookie } from "../../../../lib/auth";
import {
  atualizarReserva,
  excluirReserva,
  responderErro,
} from "../../../../lib/reservasService";

export default async function handler(req, res) {
  const admin = requireAdminCookie(req, res);
  if (!admin) return;

  const { id } = req.query;

  if (req.method === "PATCH") {
    try {
      const { action } = req.body || {};

      const reserva = await atualizarReserva(id, action);
      return res.status(200).json({ ok: true, reserva });
    } catch (err) {
      return responderErro(res, err, "Erro ao atualizar reserva.");
    }
  }

  if (req.method === "DELETE") {
    try {
      await excluirReserva(id);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return responderErro(res, err, "Erro ao excluir reserva.");
    }
  }

  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ ok: false, error: "Método não permitido" });
}