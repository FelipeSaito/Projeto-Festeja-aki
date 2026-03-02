import { dbConnect } from "../../../../lib/mongodb";
import Reserva from "../../../../models/Reserva";
import { COOKIE_NAME, verifyToken } from "../../../../lib/auth";
import Customer from "../../../../models/Customer";

export default async function handler(req, res) {
  await dbConnect();

  // 🔐 auth via cookie (o mesmo do seu /api/auth/login)
  const token = req.cookies?.[COOKIE_NAME];
  const payload = token ? verifyToken(token) : null;

  if (!payload || payload.role !== "admin") {
    return res.status(401).json({ ok: false, error: "Não autorizado" });
  }

  if (req.method === "GET") {
    const reservas = await Reserva.find({})
      .sort({ createdAt: -1 })
      .populate("customerId", "nome whatsapp email")
      .lean();

    return res.status(200).json({ ok: true, reservas });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}