
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { requireAdminCookie } from "../../../../lib/auth";

// Converte datas do Firestore para JSON
function toISO(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function serializeReserva(doc) {
  const data = doc.data();

  return {
    ...data,
    _id: doc.id,
    id: doc.id,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
    entradaPagaEm: toISO(data.entradaPagaEm),
  };
}

export default async function handler(req, res) {
  // Apenas administradores autenticados
  const admin = requireAdminCookie(req, res);
  if (!admin) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      ok: false,
      error: "Método não permitido",
    });
  }

  try {
    const db = getAdminDb();

    // Busca todas as reservas
    const snapshot = await db
      .collection("reservas")
      .get();

    const reservas = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const reserva = serializeReserva(doc);

        let cliente = null;

        if (reserva.customerId) {
          const clienteDoc = await db
            .collection("clientes")
            .doc(String(reserva.customerId))
            .get();

          if (clienteDoc.exists) {
            cliente = {
              _id: clienteDoc.id,
              id: clienteDoc.id,
              ...clienteDoc.data(),
            };
          }
        }

        // Mantém o formato do antigo populate do MongoDB
        return {
          ...reserva,
          customerId: cliente,
        };
      })
    );

    // Reservas mais recentes primeiro
    reservas.sort((a, b) => {
      const dataA = new Date(a.createdAt || 0).getTime();
      const dataB = new Date(b.createdAt || 0).getTime();

      return dataB - dataA;
    });

    return res.status(200).json({
      ok: true,
      reservas,
    });
  } catch (error) {
    console.error(
      "Erro ao listar reservas no Firestore:",
      error
    );

    return res.status(500).json({
      ok: false,
      error: "Erro ao buscar reservas.",
    });
  }
}
