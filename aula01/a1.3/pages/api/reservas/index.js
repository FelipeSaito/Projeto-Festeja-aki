import { dbConnect } from "../../../lib/mongodb";
import Reserva from "../../../models/Reserva";
import Customer from "../../../models/Customer";

function isWeekend(yyyy_mm_dd) {
  const d = new Date(`${yyyy_mm_dd}T00:00:00`);
  const day = d.getDay(); // 0 dom, 6 sab
  return day === 0 || day === 6;
}

function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

// 🔥 ADICIONE AQUI
function isValidBRPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const ddd = Number(digits.substring(0, 2));
  const ninth = digits[2];

  if (ddd < 11 || ddd > 99) return false;
  if (ninth !== "9") return false;

  return true;
}

function isValidEmail(email) {
  if (!email) return true; // email opcional

  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
  
}

function requireAdmin(req, res) {
  const key = req.headers["x-admin-key"];
  if (!key || key !== process.env.ADMIN_KEY) {
    res.status(401).json({ ok: false, error: "Não autorizado (admin)" });
    return false;
  }
  return true;
}

function isPastISO(yyyy_mm_dd) {
  const d = new Date(`${yyyy_mm_dd}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export default async function handler(req, res) {
  await dbConnect();
  
  // ============================
  // GET
  //  - normal: datas ocupadas (calendário)
  //  - admin: lista completa (?full=1)
  // ============================
  if (req.method === "GET") {
    try {
      const full = req.query.full === "1";

      // ✅ ADMIN: lista completa
      if (full) {
        if (!requireAdmin(req, res)) return;

        const reservas = await Reserva.find({})
          .sort({ createdAt: -1 })
          .populate("customerId", "nome whatsapp email")
          .lean();

        return res.status(200).json({ ok: true, reservas });
      }

      // ✅ CALENDÁRIO: só datas bloqueadas
      const reservas = await Reserva.find({
        status: { $in: ["PENDING", "CONFIRMED"] },
      })
        .select("dataReserva")
        .lean();

      const dates = reservas.map((r) => r.dataReserva);
      return res.status(200).json({ ok: true, dates });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: "Erro ao buscar reservas",
        details: String(err?.message || err),
      });
    }
  }

  // ============================
  // POST -> Criar reserva
  // ============================
  if (req.method === "POST") {
    try {
      const {
        customerId,
        nome,
        whatsapp,
        email,
        dataReserva,
        horarioInicio = "09:30",
        horarioFim = "22:00",
        valorEntrada = 0,
        valorTotal = 0,
        observacoes = "",
      } = req.body;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataReserva)) {
  return res.status(400).json({
    ok: false,
    error: "dataReserva inválida. Use YYYY-MM-DD.",
  });
}

if (!isWeekend(dataReserva)) {
  return res.status(400).json({
    ok: false,
    error: "Só é possível reservar sábado ou domingo.",
  });
}

if (isPastISO(dataReserva)) {
  return res.status(400).json({
    ok: false,
    error: "Não é possível reservar datas no passado.",
  });
}

      if (!isValidEmail(email)) {
        return res.status(400).json({
        ok: false,
        error: "Email inválido.",
      });
}

      const existing = await Reserva.findOne({
        dataReserva,
        status: { $in: ["PENDING", "CONFIRMED"] },
      })
        .select("_id")
        .lean();

      if (existing) {
        return res.status(409).json({ ok: false, error: "Essa data já está reservada." });
      }

      // ✅ resolver cliente
      let finalCustomerId = customerId;

      if (!finalCustomerId) {
        if (!nome || !whatsapp) {
          return res.status(400).json({ ok: false, error: "Informe nome e WhatsApp (ou customerId)." });
        }

        const wpp = onlyDigits(whatsapp);
          if (!isValidBRPhone(wpp)) {
            return res.status(400).json({
              ok: false,
              error: "WhatsApp inválido. Use formato 11999999999",
            });
            
          }

          let customer = await Customer.findOne({ whatsapp: wpp });

          if (!customer) {
            customer = await Customer.create({
              nome,
              whatsapp: wpp,
              email: email || "",
            });
          } else {
            // 🔥 Atualiza nome e email se forem diferentes
            const updates = {};

            if (nome && nome !== customer.nome) {
              updates.nome = nome;
            }

            if (email && email !== customer.email) {
              updates.email = email;
            }

            if (Object.keys(updates).length > 0) {
              await Customer.updateOne(
                { _id: customer._id },
                { $set: updates }
              );
            }
          }

        finalCustomerId = customer._id;
      }

      const valorEntradaNum = Number(String(valorEntrada).replace(",", "."));
      const valorTotalNum = Number(String(valorTotal).replace(",", "."));
      if (Number.isNaN(valorEntradaNum) || Number.isNaN(valorTotalNum)) {
        return res.status(400).json({ ok: false, error: "Valores inválidos." });
      }

      const reserva = await Reserva.create({
        customerId: finalCustomerId,
        dataReserva,
        horarioInicio,
        horarioFim,
        valorEntrada: valorEntradaNum,
        valorTotal: valorTotalNum,
        observacoes,
        status: "PENDING",
      });

      return res.status(201).json({ ok: true, reserva });
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(409).json({ ok: false, error: "Essa data já está reservada." });
      }

      return res.status(500).json({
        ok: false,
        error: "Erro interno",
        details: String(err?.message || err),
      });
    }
  }

  return res.status(405).json({ ok: false, error: "Método não permitido" });
}