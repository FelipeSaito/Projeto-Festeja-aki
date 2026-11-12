
import { getAdminDb } from "../../../lib/firebaseAdmin";
import { requireAdminCookie } from "../../../lib/auth";

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidBRPhone(phone) {
  const digits = onlyDigits(phone);

  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const ddd = Number(digits.slice(0, 2));
  return ddd >= 11 && ddd <= 99 && digits[2] === "9";
}

function isValidEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseDateISO(value) {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function todayInBrazil() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseMoney(value) {
  if (typeof value === "number") return value;
  return Number(String(value ?? 0).replace(",", "."));
}

function serializeDoc(doc) {
  const data = doc.data();

  return {
    ...data,
    _id: doc.id,
    id: doc.id,
    createdAt: data.createdAt?.toDate?.()?.toISOString()
      ?? data.createdAt ?? null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString()
      ?? data.updatedAt ?? null,
    entradaPagaEm: data.entradaPagaEm?.toDate?.()?.toISOString()
      ?? data.entradaPagaEm ?? null,
  };
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({
      ok: false,
      error: "Método não permitido",
    });
  }

  try {
    const db = getAdminDb();

    // GET: calendário ou listagem administrativa
    if (req.method === "GET") {
      if (req.query.full === "1") {
        const admin = requireAdminCookie(req, res);
        if (!admin) return;

        const snapshot = await db.collection("reservas").get();

        const reservas = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const reserva = serializeDoc(doc);
            const customerId = reserva.customerId;

            let cliente = null;

            if (customerId) {
              const customerDoc = await db
                .collection("clientes")
                .doc(String(customerId))
                .get();

              if (customerDoc.exists) {
                cliente = {
                  _id: customerDoc.id,
                  ...customerDoc.data(),
                };
              }
            }

            return { ...reserva, customerId: cliente };
          })
        );

        reservas.sort((a, b) =>
          String(b.createdAt ?? "").localeCompare(
            String(a.createdAt ?? "")
          )
        );

        return res.status(200).json({ ok: true, reservas });
      }

      const snapshot = await db.collection("reservas").get();

      const dates = [
        ...new Set(
          snapshot.docs
            .map((doc) => doc.data())
            .filter((r) =>
              ["PENDING", "CONFIRMED"].includes(r.status)
            )
            .map((r) => r.dataReserva)
        ),
      ];

      return res.status(200).json({ ok: true, dates });
    }

    // POST: criar reserva
    const {
      customerId,
      nome,
      whatsapp,
      email = "",
      dataReserva,
      horarioInicio = "09:30",
      horarioFim = "22:00",
      valorEntrada = 0,
      valorTotal = 0,
      observacoes = "",
    } = req.body || {};

    const date = parseDateISO(dataReserva);

    if (!date) {
      return res.status(400).json({
        ok: false,
        error: "Data inválida. Use YYYY-MM-DD.",
      });
    }

    if (![0, 6].includes(date.getUTCDay())) {
      return res.status(400).json({
        ok: false,
        error: "Só é possível reservar sábado ou domingo.",
      });
    }

    if (dataReserva < todayInBrazil()) {
      return res.status(400).json({
        ok: false,
        error: "Não é possível reservar datas no passado.",
      });
    }

    if (horarioInicio !== "09:30" || horarioFim !== "22:00") {
      return res.status(400).json({
        ok: false,
        error: "O horário permitido é das 09:30 às 22:00.",
      });
    }

    const nomeLimpo = String(nome || "").trim();
    const wpp = onlyDigits(whatsapp);
    const emailLimpo = String(email || "").trim();

    if (!isValidEmail(emailLimpo)) {
      return res.status(400).json({
        ok: false,
        error: "E-mail inválido.",
      });
    }

    if (!customerId && (!nomeLimpo || !isValidBRPhone(wpp))) {
      return res.status(400).json({
        ok: false,
        error: "Informe nome e WhatsApp válido.",
      });
    }

    const entrada = parseMoney(valorEntrada);
    const total = parseMoney(valorTotal);

    if (
      !Number.isFinite(entrada) ||
      !Number.isFinite(total) ||
      entrada < 0 ||
      total < 0 ||
      entrada > total
    ) {
      return res.status(400).json({
        ok: false,
        error: "Valores inválidos.",
      });
    }

    const reservaRef = db.collection("reservas").doc();
    const diaRef = db.collection("diasReservados").doc(dataReserva);

    let finalCustomerId = null;

    if (customerId) {
      finalCustomerId = String(customerId);
    } else {
      // WhatsApp normalizado como identificador único.
      finalCustomerId = wpp;
    }

    const clienteRef = db
      .collection("clientes")
      .doc(finalCustomerId);

    const agora = new Date();

    const resultado = await db.runTransaction(async (transaction) => {
      // Todas as leituras vêm antes das gravações.
      const [diaDoc, clienteDoc] = await Promise.all([
        transaction.get(diaRef),
        transaction.get(clienteRef),
      ]);

      if (diaDoc.exists) {
        const erro = new Error("Essa data já está reservada.");
        erro.statusCode = 409;
        throw erro;
      }

      if (customerId && !clienteDoc.exists) {
        const erro = new Error("Cliente não encontrado.");
        erro.statusCode = 400;
        throw erro;
      }

      if (!customerId) {
        const cliente = {
          nome: nomeLimpo,
          whatsapp: wpp,
          email: emailLimpo,
          updatedAt: agora,
        };

        if (!clienteDoc.exists) {
          cliente.createdAt = agora;
        }

        transaction.set(clienteRef, cliente, { merge: true });
      }

      const reserva = {
        customerId: finalCustomerId,
        dataReserva,
        horarioInicio: "09:30",
        horarioFim: "22:00",
        status: "PENDING",
        valorEntrada: entrada,
        valorTotal: total,
        entradaPaga: false,
        entradaPagaEm: null,
        observacoes: String(observacoes || ""),
        createdAt: agora,
        updatedAt: agora,
      };

      transaction.create(reservaRef, reserva);

      // Documento de bloqueio para evitar reservas simultâneas.
      transaction.create(diaRef, {
        reservaId: reservaRef.id,
        dataReserva,
        createdAt: agora,
      });

      return {
        ...reserva,
        _id: reservaRef.id,
        id: reservaRef.id,
        createdAt: agora.toISOString(),
        updatedAt: agora.toISOString(),
      };
    });

    return res.status(201).json({
      ok: true,
      reserva: resultado,
    });
  } catch (err) {
    console.error("Erro na API de reservas:", err);

    if (err.statusCode) {
      return res.status(err.statusCode).json({
        ok: false,
        error: err.message,
      });
    }

    return res.status(500).json({
      ok: false,
      error: "Erro interno ao processar reserva.",
    });
  }
}
