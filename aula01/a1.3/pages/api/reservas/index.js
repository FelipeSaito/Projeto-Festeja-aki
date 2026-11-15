// pages/api/reservas/index.js
// API PÚBLICA: calendário (GET) e formulário de reserva (POST).
// Não expõe dados pessoais e ignora valores enviados pelo navegador.
import {
  listarDatasOcupadas,
  criarReserva,
  responderErro,
} from "../../../lib/reservasService";
import { enviarNotificacao } from "../../../lib/push";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// "2026-11-21" -> "sáb, 21/11"
function dataCurta(dataISO) {
  const [ano, mes, dia] = String(dataISO || "").split("-").map(Number);
  if (!ano || !mes || !dia) return String(dataISO || "");

  const semana = DIAS[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  return `${semana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

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

      // Avisa os aparelhos do painel. Uma falha aqui não pode derrubar a reserva.
      try {
        const cliente = String(nome || "").trim().slice(0, 60) || "Um cliente";

        const resultado = await enviarNotificacao({
          title: "Nova reserva",
          body: `${cliente} escolheu ${dataCurta(reserva.dataReserva)}. Aguardando o sinal.`,
          url: "/admin/reservas",
        });

        // Só a contagem, sem dados do cliente
        console.log(
          `Notificações da nova reserva: ${resultado.enviadas} enviada(s), ${resultado.falhas} falha(s).`
        );
      } catch (err) {
        console.error("Falha ao notificar nova reserva.", err?.message || err);
      }

      return res.status(201).json({ ok: true, reserva });
    } catch (err) {
      return responderErro(res, err, "Erro interno ao processar reserva.");
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Método não permitido" });
}