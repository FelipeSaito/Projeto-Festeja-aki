// pages/api/cron/liberar-vencidas.js
// Chamada pelo Cron da Vercel uma vez por dia, de manhã.
// 1. Cancela reservas PENDING sem sinal com prazo vencido e libera as datas.
// 2. Envia o lembrete das limpezas marcadas para hoje.
import {
  liberarReservasVencidas,
  responderErro,
} from "../../../lib/reservasService";
import {
  limpezasDeHoje,
  dataPorExtenso,
  descreverLimpeza,
} from "../../../lib/limpezaService";
import { enviarNotificacao } from "../../../lib/push";

// Devolve quantas limpezas de hoje foram lembradas. Nunca derruba o cron.
async function lembrarLimpezas() {
  try {
    const pendentes = await limpezasDeHoje();
    if (pendentes.length === 0) return 0;

    const primeira = pendentes[0];

    const body =
      pendentes.length === 1
        ? `${descreverLimpeza(primeira)}: festa de ${primeira.cliente.nome} em ${dataPorExtenso(
            primeira.dataReserva
          )}.`
        : `${pendentes.length} limpezas para hoje. Abra o checklist para ver.`;

    await enviarNotificacao({
      title: "Limpeza do salão hoje",
      body,
      url: "/admin/limpeza",
    });

    return pendentes.length;
  } catch (err) {
    console.error("Falha ao lembrar das limpezas de hoje.", err?.message || err);
    return 0;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  // A Vercel envia "Authorization: Bearer <CRON_SECRET>" nas chamadas do cron.
  const segredo = process.env.CRON_SECRET;

  if (!segredo || req.headers.authorization !== `Bearer ${segredo}`) {
    // Registra só o motivo, nunca o cabeçalho recebido nem o segredo
    console.warn(
      segredo
        ? "Cron: chamada recusada (sem autorização válida)."
        : "Cron: CRON_SECRET não configurado; chamada recusada."
    );
    return res.status(401).json({ ok: false, error: "Não autorizado" });
  }

  try {
    const { liberadas } = await liberarReservasVencidas();
    const lembretes = await lembrarLimpezas();

    // Sempre deixa uma linha nos logs, para dar para conferir que o cron rodou
    console.log(
      `Cron: ${liberadas} reserva(s) vencida(s) liberada(s), ${lembretes} lembrete(s) de limpeza.`
    );

    return res.status(200).json({ ok: true, liberadas, lembretes });
  } catch (err) {
    return responderErro(res, err, "Erro ao liberar reservas vencidas.");
  }
}