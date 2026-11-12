
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { requireAdminCookie } from "../../../../lib/auth";

const ACTIONS = [
  "CONFIRM",
  "CANCEL",
  "MARK_ENTRY_PAID",
  "UNMARK_ENTRY_PAID",
];

function serializeReserva(id, data) {
  const toISO = (value) =>
    value?.toDate?.()?.toISOString() ??
    (value instanceof Date ? value.toISOString() : value ?? null);

  return {
    ...data,
    _id: id,
    id,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
    entradaPagaEm: toISO(data.entradaPagaEm),
  };
}

export default async function handler(req, res) {
  // Autenticação administrativa
  const admin = requireAdminCookie(req, res);
  if (!admin) return;

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({
      ok: false,
      error: "Método não permitido",
    });
  }

  const { id } = req.query;
  const { action } = req.body || {};

  if (typeof id !== "string" || !id) {
    return res.status(400).json({
      ok: false,
      error: "ID da reserva inválido.",
    });
  }

  if (!ACTIONS.includes(action)) {
    return res.status(400).json({
      ok: false,
      error: "Ação inválida.",
    });
  }

  try {
    const db = getAdminDb();
    const reservaRef = db.collection("reservas").doc(id);

    const resultado = await db.runTransaction(async (transaction) => {
      const reservaDoc = await transaction.get(reservaRef);

      if (!reservaDoc.exists) {
        const erro = new Error("Reserva não encontrada.");
        erro.statusCode = 404;
        throw erro;
      }

      const reserva = reservaDoc.data();
      const diaRef = db
        .collection("diasReservados")
        .doc(reserva.dataReserva);

      // Ler o bloqueio antes de qualquer gravação.
      const diaDoc = await transaction.get(diaRef);
      const agora = new Date();

      const updates = { updatedAt: agora };

      if (action === "CONFIRM") {
        if (reserva.status === "CANCELLED") {
          const erro = new Error(
            "Não é possível confirmar uma reserva cancelada."
          );
          erro.statusCode = 409;
          throw erro;
        }

        if (
          diaDoc.exists &&
          diaDoc.data().reservaId !== id
        ) {
          const erro = new Error(
            "A data está bloqueada por outra reserva."
          );
          erro.statusCode = 409;
          throw erro;
        }

        updates.status = "CONFIRMED";

        if (!diaDoc.exists) {
          transaction.create(diaRef, {
            reservaId: id,
            dataReserva: reserva.dataReserva,
            createdAt: agora,
          });
        }
      }

      if (action === "CANCEL") {
        updates.status = "CANCELLED";

        // Só remove o bloqueio se pertencer a esta reserva.
        if (
          diaDoc.exists &&
          diaDoc.data().reservaId === id
        ) {
          transaction.delete(diaRef);
        }
      }

      if (action === "MARK_ENTRY_PAID") {
        if (reserva.status === "CANCELLED") {
          const erro = new Error(
            "Não é possível registrar pagamento em reserva cancelada."
          );
          erro.statusCode = 409;
          throw erro;
        }

        updates.entradaPaga = true;
        updates.entradaPagaEm =
          reserva.entradaPagaEm || agora;
      }

      if (action === "UNMARK_ENTRY_PAID") {
        updates.entradaPaga = false;
        updates.entradaPagaEm = null;
      }

      transaction.update(reservaRef, updates);

      return {
        ...reserva,
        ...updates,
      };
    });

    return res.status(200).json({
      ok: true,
      reserva: serializeReserva(id, resultado),
    });
  } catch (err) {
    console.error("Erro ao atualizar reserva:", err);

    if (err.statusCode) {
      return res.status(err.statusCode).json({
        ok: false,
        error: err.message,
      });
    }

    return res.status(500).json({
      ok: false,
      error: "Erro ao atualizar reserva.",
    });
  }
}
