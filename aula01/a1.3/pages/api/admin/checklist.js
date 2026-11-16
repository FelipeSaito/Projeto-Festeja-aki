// pages/api/admin/checklist.js
// API ADMIN: checklist de limpeza do salão.
// GET lista as próximas limpezas; PATCH marca ou desmarca um item.
import { requireAdminCookie } from "../../../lib/auth";
import { responderErro, todayInBrazil } from "../../../lib/reservasService";
import { listarLimpezas, marcarItemLimpeza } from "../../../lib/limpezaService";

export default async function handler(req, res) {
  const admin = requireAdminCookie(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    try {
      const limpezas = await listarLimpezas();
      return res.status(200).json({ ok: true, hoje: todayInBrazil(), limpezas });
    } catch (err) {
      return responderErro(res, err, "Erro ao buscar o checklist de limpeza.");
    }
  }

  if (req.method === "PATCH") {
    try {
      const { reservaId, itemId, feito } = req.body || {};

      const limpeza = await marcarItemLimpeza(reservaId, itemId, feito);
      return res.status(200).json({ ok: true, limpeza });
    } catch (err) {
      return responderErro(res, err, "Erro ao salvar o checklist de limpeza.");
    }
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ ok: false, error: "Método não permitido" });
}