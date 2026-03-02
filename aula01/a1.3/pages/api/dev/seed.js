import { dbConnect } from "../../../lib/mongodb";
import Customer from "../../../models/Customer";
import Reserva from "../../../models/Reserva";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  try {
    await dbConnect();

    const key = req.headers["x-dev-key"];
    if (!process.env.DEV_KEY || key !== process.env.DEV_KEY) {
      return res.status(401).json({ ok: false, error: "Não autorizado" });
    }

    // 📅 data dinâmica
    const today = new Date();
    const yyyy_mm_dd = today.toISOString().slice(0, 10);

    // 📱 whatsapp único
    const random = Math.floor(Math.random() * 10000);
    const whatsapp = `1199${random}0000`;

    const customer = await Customer.create({
      nome: "Cliente Teste",
      whatsapp,
      email: "cliente@teste.com",
    });

    const reserva = await Reserva.create({
      customerId: customer._id,
      dataReserva: yyyy_mm_dd,
      status: "PENDING",
      valorEntrada: 100,
      valorTotal: 600,
    });

    return res.status(200).json({
      ok: true,
      customer,
      reserva,
    });

  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
}