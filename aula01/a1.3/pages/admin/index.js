import { dbConnect } from "../../../../lib/mongodb";
import Reserva from "../../../../models/Reserva";

function requireAdmin(req, res) {
  const key = req.headers["x-admin-key"];
  if (!key || key !== process.env.ADMIN_KEY) {
    res.status(401).json({ ok: false, error: "Não autorizado (admin)" });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  await dbConnect();

  if (!requireAdmin(req, res)) return;

  if (req.method === "GET") {
    const reservas = await Reserva.find({})
      .sort({ createdAt: -1 })
      .populate("customerId", "nome whatsapp email")
      .lean();

    return res.status(200).json({ ok: true, reservas });
  }

  return res.status(405).json({ ok: false, error: "Método não permitido" });
}