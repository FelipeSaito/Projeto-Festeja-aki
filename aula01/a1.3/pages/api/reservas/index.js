// pages/api/reservas/index.js
// API PÚBLICA: calendário (GET) e formulário de reserva (POST).
// Não expõe dados pessoais e ignora valores enviados pelo navegador.
import {
  listarDatasOcupadas,
  criarReserva,
  responderErro,
} from "../../../lib/reservasService";

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const dates = await listarDatasOcupadas();
      return res.status(200).json({ ok: true, dates });
    } catch (err) {
      return responderErro(res, err, "Erro ao buscar datas ocupadas.");
    }
  }

  if (req.method === "POST") {
    try {
      // Apenas os campos que o cliente pode escolher.
      // valorEntrada, valorTotal, horários e status são definidos no servidor.
      const { nome, whatsapp, email, dataReserva, observacoes } = req.body || {};

      const reserva = await criarReserva({
        nome,
        whatsapp,
        email,
        dataReserva,
        observacoes,
      });

      return res.status(201).json({ ok: true, reserva });
    } catch (err) {
      return responderErro(res, err, "Erro interno ao processar reserva.");
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Método não permitido" });
}