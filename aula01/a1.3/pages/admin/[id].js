import { dbConnect } from "../../../lib/mongodb";
import Reserva from "../../../models/Reserva";
import mongoose from "mongoose";

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

  const { id } = req.query;

  // ✅ evita erro quando id é inválido
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ ok: false, error: "ID inválido" });
  }

  // ✅ só admin pode alterar status
  if (!requireAdmin(req, res)) return;

  if (req.method === "PATCH") {
    try {
      const { action, valorEntrada } = req.body;

      const a = String(action || "").toLowerCase(); // ✅ aceita "CONFIRM" e "confirm"

      if (a === "confirm") {
        await Reserva.findByIdAndUpdate(id, { status: "CONFIRMED" });
        return res.status(200).json({ ok: true });
      }

      if (a === "cancel") {
        await Reserva.findByIdAndUpdate(id, { status: "CANCELLED" });
        return res.status(200).json({ ok: true });
      }

      if (a === "entrada_paga") {
        const valor = Number(valorEntrada || 0);

        if (Number.isNaN(valor) || valor < 0) {
          return res.status(400).json({ ok: false, error: "valorEntrada inválido" });
        }

        await Reserva.findByIdAndUpdate(id, {
          valorEntrada: valor,
          entradaPaga: true,
          entradaPagaEm: new Date(),
        });

        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ ok: false, error: "Ação inválida" });
    } catch (err) {
      // ✅ se bater no índice unique/partial
      if (err?.code === 11000) {
        return res.status(409).json({ ok: false, error: "Já existe reserva ativa nessa data." });
      }

      return res.status(500).json({
        ok: false,
        error: "Erro interno",
        details: String(err?.message || err),
      });
    }
  }

  // ✅ em vez de deletar, cancelar
  if (req.method === "DELETE") {
    try {
      await Reserva.findByIdAndUpdate(id, { status: "CANCELLED" });
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, error: "Erro ao cancelar" });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}