// pages/api/dev/seed.js
// Cria um cliente de teste + uma reserva PENDING no próximo fim de semana livre.
// Só funciona fora de produção e com o admin logado (cookie fa_token).
import { getAdminDb } from "../../../lib/firebaseAdmin";
import { requireAdminCookie } from "../../../lib/auth";

const VALOR_TOTAL = 750;
const VALOR_ENTRADA = 150;

const CLIENTE_TESTE = {
  nome: "Cliente Teste",
  whatsapp: "11999990000",
  email: "cliente@teste.com",
};

// Formata a data local como YYYY-MM-DD (evita o deslocamento de fuso do toISOString)
function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Próximos N sábados/domingos a partir de amanhã
function proximosFinsDeSemana(qtd) {
  const datas = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (datas.length < qtd) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay(); // 0 dom, 6 sab
    if (dia === 0 || dia === 6) datas.push(toISODate(d));
  }
  return datas;
}

export default async function handler(req, res) {
  // 🚫 Nunca disponível em produção
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ ok: false, error: "Não encontrado" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  // 🔐 Exige admin logado
  const admin = requireAdminCookie(req, res);
  if (!admin) return;

  try {
    const db = getAdminDb();
    const now = new Date();

    // 1) Cliente de teste (reaproveita se já existir pelo WhatsApp)
    const clientesRef = db.collection("clientes");
    const existente = await clientesRef
      .where("whatsapp", "==", CLIENTE_TESTE.whatsapp)
      .limit(1)
      .get();

    let customerId;
    if (!existente.empty) {
      customerId = existente.docs[0].id;
    } else {
      const novo = await clientesRef.add({
        ...CLIENTE_TESTE,
        createdAt: now,
        updatedAt: now,
      });
      customerId = novo.id;
    }

    // 2) Reserva + bloqueio da data, atomicamente
    const candidatas = proximosFinsDeSemana(12);
    const reservaRef = db.collection("reservas").doc();

    const dataReserva = await db.runTransaction(async (tx) => {
      // Todas as leituras antes de qualquer escrita (regra do Firestore)
      const bloqueios = await Promise.all(
        candidatas.map((data) => tx.get(db.collection("diasReservados").doc(data)))
      );

      const idx = bloqueios.findIndex((snap) => !snap.exists);
      if (idx === -1) return null;

      const data = candidatas[idx];

      tx.set(reservaRef, {
        customerId,
        dataReserva: data,
        horarioInicio: "09:30",
        horarioFim: "22:00",
        status: "PENDING",
        valorEntrada: VALOR_ENTRADA,
        valorTotal: VALOR_TOTAL,
        entradaPaga: false,
        entradaPagaEm: null,
        observacoes: "Reserva de teste (seed)",
        createdAt: now,
        updatedAt: now,
      });

      tx.set(db.collection("diasReservados").doc(data), {
        reservaId: reservaRef.id,
        dataReserva: data,
        createdAt: now,
      });

      return data;
    });

    if (!dataReserva) {
      return res.status(409).json({
        ok: false,
        error: "Nenhum fim de semana livre nas próximas 12 datas.",
      });
    }

    return res.status(201).json({
      ok: true,
      customerId,
      reservaId: reservaRef.id,
      dataReserva,
    });
  } catch (err) {
    console.error("[seed] erro:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Erro ao criar dados de teste" });
  }
}