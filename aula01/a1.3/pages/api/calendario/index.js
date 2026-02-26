import { dbConnect } from "../../../lib/mongodb";
import Reserva from "../../../models/Reserva";

function isWeekendISO(yyyy_mm_dd) {
  const d = new Date(`${yyyy_mm_dd}T00:00:00`);
  const day = d.getDay(); // 0 dom, 6 sab
  return day === 0 || day === 6;
}

export default async function handler(req, res) {
  await dbConnect();

  // GET -> listar datas ocupadas
  if (req.method === "GET") {
    const reservas = await Reserva.find({ status: { $ne: "cancelada" } })
      .select("data_evento")
      .lean();

    const datas = reservas.map((r) => r.data_evento);
    return res.status(200).json({ dates: datas });
  }

  // POST -> criar reserva
  if (req.method === "POST") {
    try {
      const { data_evento, nome, whatsapp, email } = req.body;

      if (!data_evento || !nome || !whatsapp) {
        return res.status(400).json({ error: "Campos obrigatórios faltando" });
      }

      if (!isWeekendISO(data_evento)) {
        return res.status(400).json({ error: "Só pode reservar sábado ou domingo" });
      }

      await Reserva.create({
        data_evento,
        nome,
        whatsapp,
        email,
        horario_inicio: "09:30",
        horario_fim: "22:00",
        status: "pendente",
      });

      return res.status(201).json({ ok: true });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: "Data já reservada" });
      }
      return res.status(500).json({ error: "Erro interno" });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}