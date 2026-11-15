// pages/api/admin/reservas/index.js
// API ADMIN: lista todas as reservas com os dados do cliente.
import { requireAdminCookie } from "../../../../lib/auth";
import { listarReservas, responderErro } from "../../../../lib/reservasService";

export default async function handler(req, res) {
  const admin = requireAdminCookie(req, res);
  if (!admin) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  try {
    const reservas = await listarReservas();
    return res.status(200).json({ ok: true, reservas });
  } catch (err) {
    return responderErro(res, err, "Erro ao buscar reservas.");
  }
}