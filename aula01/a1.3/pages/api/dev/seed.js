// pages/api/dev/seed.js
// Cria uma reserva de teste no próximo fim de semana livre,
// passando pelas MESMAS regras do formulário (lib/reservasService).
// Só funciona fora de produção e com o admin logado (cookie fa_token).
import { requireAdminCookie } from "../../../lib/auth";
import { criarReserva, responderErro, ReservaError } from "../../../lib/reservasService";

const CLIENTE_TESTE = {
  nome: "Cliente Teste",
  whatsapp: "11999990000",
  email: "cliente@teste.com",
};

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
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  // 🔐 Exige admin logado
  const admin = requireAdminCookie(req, res);
  if (!admin) return;

  try {
    for (const dataReserva of proximosFinsDeSemana(12)) {
      try {
        const reserva = await criarReserva({
          ...CLIENTE_TESTE,
          dataReserva,
          observacoes: "Reserva de teste (seed)",
        });

        return res.status(201).json({
          ok: true,
          customerId: reserva.customerId,
          reservaId: reserva.id,
          dataReserva: reserva.dataReserva,
        });
      } catch (err) {
        // Data ocupada: tenta o próximo fim de semana
        if (err instanceof ReservaError && err.statusCode === 409) continue;
        throw err;
      }
    }

    return res.status(409).json({
      ok: false,
      error: "Nenhum fim de semana livre nas próximas 12 datas.",
    });
  } catch (err) {
    return responderErro(res, err, "Erro ao criar dados de teste.");
  }
}