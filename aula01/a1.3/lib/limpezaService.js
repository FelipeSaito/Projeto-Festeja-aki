// lib/limpezaService.js
// Checklist de limpeza do salão, uma limpeza por festa confirmada.
// Roda SOMENTE no servidor (usa o Firebase Admin SDK). Nunca importe em páginas.
import { getAdminDb } from "./firebaseAdmin";
import {
  ReservaError,
  STATUS,
  parseDateISO,
  todayInBrazil,
  toISO,
} from "./reservasService";

const COL_RESERVAS = "reservas";
const COL_CLIENTES = "clientes";

// ============================================================
// Itens do checklist
// Para mudar a lista, edite apenas aqui. O "id" não deve ser alterado
// depois que o item já foi usado, porque é ele que fica salvo na reserva.
// ============================================================
export const ITENS_LIMPEZA = [
  { id: "banheiros", label: "Lavar os banheiros masculino e feminino" },
  { id: "papel-lixo", label: "Conferir papel higiênico e lixo dos banheiros" },
  { id: "salao-tras", label: "Lavar a parte de trás do salão" },
  { id: "salao-frente", label: "Lavar a parte da frente do salão" },
  { id: "churrasqueira", label: "Lavar a grelha e tirar o carvão da churrasqueira" },
  { id: "som", label: "Verificar o som" },
  { id: "brinquedao", label: "Passar pano no brinquedão" },
];

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// ============================================================
// Datas
// ============================================================

// "YYYY-MM-DD" + n dias -> "YYYY-MM-DD"
function somarDias(dataISO, dias) {
  const d = parseDateISO(dataISO);
  if (!d) return null;

  d.setUTCDate(d.getUTCDate() + dias);

  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mes}-${dia}`;
}

// "2026-11-20" -> "sexta, 20/11"
export function dataPorExtenso(dataISO) {
  const d = parseDateISO(dataISO);
  if (!d) return String(dataISO || "");

  const [, mes, dia] = dataISO.split("-");
  return `${DIAS[d.getUTCDay()]}, ${dia}/${mes}`;
}

// Regra do salão para o dia da limpeza:
//  - festa no sábado                      -> limpeza na sexta
//  - festa só no domingo                  -> limpeza no sábado
//  - festa no sábado E no domingo         -> a de domingo é limpa no domingo de manhã
// "datasConfirmadas" é um Set com as datas ("YYYY-MM-DD") das festas confirmadas.
export function calcularLimpeza(dataReserva, datasConfirmadas) {
  const d = parseDateISO(dataReserva);
  if (!d) return null;

  const vespera = somarDias(dataReserva, -1);

  if (d.getUTCDay() === 0 && datasConfirmadas.has(vespera)) {
    return { data: dataReserva, periodo: "manha" };
  }

  return { data: vespera, periodo: "dia" };
}

// "sexta, 20/11" ou "domingo, 22/11 de manhã"
export function descreverLimpeza(limpeza) {
  const quando = dataPorExtenso(limpeza.dataLimpeza);
  return limpeza.periodo === "manha" ? `${quando} de manhã` : quando;
}

// ============================================================
// Montagem
// ============================================================

function montarLimpeza(id, reserva, cliente, datasConfirmadas) {
  const regra = calcularLimpeza(reserva.dataReserva, datasConfirmadas);
  const marcados = reserva.limpeza?.itens || {};

  const itens = ITENS_LIMPEZA.map((item) => ({
    ...item,
    feito: marcados[item.id] === true,
  }));

  const feitos = itens.filter((item) => item.feito).length;

  return {
    reservaId: id,
    // Código da página de acompanhamento do cliente (/reserva/<código>),
    // usado pelo painel para montar o link no aviso de "salão pronto".
    tokenAcompanhamento: reserva.tokenAcompanhamento || "",
    dataReserva: reserva.dataReserva,
    dataLimpeza: regra?.data || null,
    periodo: regra?.periodo || "dia",
    cliente: {
      nome: cliente?.nome || "Cliente",
      whatsapp: cliente?.whatsapp || "",
    },
    itens,
    feitos,
    total: itens.length,
    concluida: itens.length > 0 && feitos === itens.length,
    concluidaEm: toISO(reserva.limpeza?.concluidaEm),
  };
}

// ============================================================
// Consultas
// ============================================================

// Limpezas das festas confirmadas de hoje em diante, em ordem de data.
export async function listarLimpezas() {
  const db = getAdminDb();
  const hoje = todayInBrazil();

  const snapshot = await db
    .collection(COL_RESERVAS)
    .where("status", "==", STATUS.CONFIRMED)
    .get();

  const confirmadas = snapshot.docs.filter((doc) => parseDateISO(doc.get("dataReserva")));
  const datasConfirmadas = new Set(confirmadas.map((doc) => doc.get("dataReserva")));
  const futuras = confirmadas.filter((doc) => doc.get("dataReserva") >= hoje);

  // Clientes das reservas, buscados de uma vez
  const ids = [...new Set(futuras.map((doc) => doc.get("customerId")).filter(Boolean).map(String))];
  const clientes = new Map();

  if (ids.length > 0) {
    const docs = await db.getAll(...ids.map((id) => db.collection(COL_CLIENTES).doc(id)));
    for (const doc of docs) {
      if (doc.exists) clientes.set(doc.id, doc.data());
    }
  }

  return futuras
    .map((doc) => {
      const reserva = doc.data();
      const cliente = clientes.get(String(reserva.customerId || ""));
      return montarLimpeza(doc.id, reserva, cliente, datasConfirmadas);
    })
    .sort(
      (a, b) =>
        String(a.dataLimpeza).localeCompare(String(b.dataLimpeza)) ||
        String(a.dataReserva).localeCompare(String(b.dataReserva))
    );
}

// A limpeza de uma reserva específica (ou null se ela não estiver na lista)
export async function buscarLimpezaDaReserva(reservaId) {
  const limpezas = await listarLimpezas();
  return limpezas.find((limpeza) => limpeza.reservaId === reservaId) || null;
}

// Limpezas marcadas para hoje que ainda não foram concluídas
export async function limpezasDeHoje() {
  const hoje = todayInBrazil();
  const limpezas = await listarLimpezas();
  return limpezas.filter((limpeza) => limpeza.dataLimpeza === hoje && !limpeza.concluida);
}

// ============================================================
// Marcação
// ============================================================

// Marca ou desmarca um item do checklist de uma reserva confirmada.
export async function marcarItemLimpeza(reservaId, itemId, feito) {
  if (typeof reservaId !== "string" || !reservaId) {
    throw new ReservaError("ID da reserva inválido.");
  }

  if (!ITENS_LIMPEZA.some((item) => item.id === itemId)) {
    throw new ReservaError("Item do checklist inválido.");
  }

  if (typeof feito !== "boolean") {
    throw new ReservaError("Informe se o item foi feito ou não.");
  }

  const db = getAdminDb();
  const reservaRef = db.collection(COL_RESERVAS).doc(reservaId);

  return db.runTransaction(async (tx) => {
    const reservaDoc = await tx.get(reservaRef);

    if (!reservaDoc.exists) {
      throw new ReservaError("Reserva não encontrada.", 404);
    }

    const reserva = reservaDoc.data();

    if (reserva.status !== STATUS.CONFIRMED) {
      throw new ReservaError("O checklist só vale para reservas confirmadas.", 409);
    }

    const agora = new Date();
    const itens = {};

    // Mantém só os itens que ainda existem na lista
    for (const item of ITENS_LIMPEZA) {
      if (reserva.limpeza?.itens?.[item.id] === true) itens[item.id] = true;
    }

    if (feito) itens[itemId] = true;
    else delete itens[itemId];

    const concluida = ITENS_LIMPEZA.every((item) => itens[item.id] === true);
    const concluidaEm = concluida ? reserva.limpeza?.concluidaEm || agora : null;

    tx.update(reservaRef, {
      limpeza: { itens, concluidaEm, updatedAt: agora },
    });

    return { itens, concluida, concluidaEm: toISO(concluidaEm) };
  });
}