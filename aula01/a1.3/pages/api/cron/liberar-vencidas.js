// pages/api/cron/liberar-vencidas.js
// Chamada pelo Cron da Vercel uma vez por dia.
// Cancela reservas PENDING sem sinal com prazo vencido e libera as datas.
import {
  liberarReservasVencidas,
  responderErro,
} from "../../../lib/reservasService";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  // A Vercel envia "Authorization: Bearer <CRON_SECRET>" nas chamadas do cron.
  const segredo = process.env.CRON_SECRET;

  if (!segredo || req.headers.authorization !== `Bearer ${segredo}`) {
    return res.status(401).json({ ok: false, error: "Não autorizado" });
  }

  try {
    const { liberadas } = await liberarReservasVencidas();
    return res.status(200).json({ ok: true, liberadas });
  } catch (err) {
    return responderErro(res, err, "Erro ao liberar reservas vencidas.");
  }
}