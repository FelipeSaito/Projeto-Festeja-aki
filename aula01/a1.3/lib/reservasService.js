// lib/reservasService.js
// Regras de negócio das reservas do Festeja Aki.
// Roda SOMENTE no servidor (usa o Firebase Admin SDK). Nunca importe em páginas.
import crypto from "crypto";
import { getAdminDb } from "./firebaseAdmin";

// ============================================================
// Condições comerciais e constantes
// ============================================================
export const VALOR_TOTAL = 750;
export const VALOR_ENTRADA = 150;
export const HORARIO_INICIO = "09:30";
export const HORARIO_FIM = "22:00";

// Prazo para o cliente pagar o sinal antes de a data ser liberada
export const PRAZO_SINAL_HORAS = 24;
const PRAZO_SINAL_MS = PRAZO_SINAL_HORAS * 60 * 60 * 1000;

export const STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
};

export const ACOES = [
  "CONFIRM",
  "CANCEL",
  "MARK_ENTRY_PAID",
  "UNMARK_ENTRY_PAID",
  "CONFIRM_ENTRY", // "Sinal recebido → Confirmar": marca a entrada e confirma de uma vez
];

const TIME_ZONE = "America/Sao_Paulo";

const COL_RESERVAS = "reservas";
const COL_CLIENTES = "clientes";
const COL_DIAS = "diasReservados";

// ============================================================
// Erro de regra de negócio (carrega o status HTTP sugerido)
// ============================================================
export class ReservaError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ReservaError";
    this.statusCode = statusCode;
  }
}

// ============================================================
// Utilitários
// ============================================================
export function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isValidBRPhone(phone) {
  const digits = onlyDigits(phone);

  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const ddd = Number(digits.slice(0, 2));
  return ddd >= 11 && ddd <= 99 && digits[2] === "9";
}

export function isValidEmail(email) {
  if (!email) return true; // e-mail é opcional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// "YYYY-MM-DD" -> Date (UTC) ou null se inválida
export function parseDateISO(value) {
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

// Data de hoje no fuso de São Paulo, como "YYYY-MM-DD"
export function todayInBrazil() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Timestamp do Firestore / Date -> string ISO
export function toISO(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

// Timestamp do Firestore / Date / string ISO -> milissegundos (ou null)
export function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

// Prazo que realmente vale: só reservas PENDING sem entrada paga expiram.
// Confirmadas, pagas ou canceladas -> null (não expiram).
export function prazoEfetivo(reserva) {
  if (!reserva) return null;
  if (reserva.status !== STATUS.PENDING) return null;
  if (reserva.entradaPaga) return null;
  return reserva.expiraEm || null;
}

// true se a reserva está PENDING, sem sinal e com o prazo vencido
export function estaVencida(reserva, agoraMs = Date.now()) {
  const prazo = toMillis(prazoEfetivo(reserva));
  return prazo !== null && prazo <= agoraMs;
}

// Código secreto da página de acompanhamento do cliente (/reserva/<token>).
// 24 bytes aleatórios -> 32 caracteres em base64url.
function gerarTokenAcompanhamento() {
  return crypto.randomBytes(24).toString("base64url");
}

const TOKEN_REGEX = /^[A-Za-z0-9_-]{32}$/;

// Situações mostradas ao cliente na página de acompanhamento
export const SITUACAO = {
  AGUARDANDO_SINAL: "AGUARDANDO_SINAL",
  SINAL_RECEBIDO: "SINAL_RECEBIDO",
  CONFIRMADA: "CONFIRMADA",
  SALAO_PRONTO: "SALAO_PRONTO",
  REALIZADA: "REALIZADA",
  PRAZO_ENCERRADO: "PRAZO_ENCERRADO",
  CANCELADA: "CANCELADA",
};

function situacaoPublica(reserva, agoraMs = Date.now()) {
  if (reserva.status === STATUS.CANCELLED) {
    return reserva.canceladaAutomaticamente
      ? SITUACAO.PRAZO_ENCERRADO
      : SITUACAO.CANCELADA;
  }

  if (reserva.status === STATUS.CONFIRMED) {
    if (reserva.dataReserva < todayInBrazil()) return SITUACAO.REALIZADA;

    // Checklist de limpeza concluído (campo gravado pelo lib/limpezaService.js)
    if (reserva.limpeza?.concluidaEm) return SITUACAO.SALAO_PRONTO;

    return SITUACAO.CONFIRMADA;
  }

  // PENDING
  if (reserva.entradaPaga) return SITUACAO.SINAL_RECEBIDO;
  if (estaVencida(reserva, agoraMs)) return SITUACAO.PRAZO_ENCERRADO;
  return SITUACAO.AGUARDANDO_SINAL;
}

function serializeReserva(id, data) {
  return {
    ...data,
    _id: id,
    id,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
    entradaPagaEm: toISO(data.entradaPagaEm),
    expiraEm: toISO(data.expiraEm),
    canceladaEm: toISO(data.canceladaEm),
  };
}

function serializeCliente(id, data) {
  return {
    ...data,
    _id: id,
    id,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
  };
}

// Lança ReservaError se a data não puder ser reservada
export function validarDataReserva(dataReserva) {
  const date = parseDateISO(dataReserva);

  if (!date) {
    throw new ReservaError("Data inválida. Use YYYY-MM-DD.");
  }

  if (![0, 6].includes(date.getUTCDay())) {
    throw new ReservaError("Só é possível reservar sábado ou domingo.");
  }

  if (dataReserva < todayInBrazil()) {
    throw new ReservaError("Não é possível reservar datas no passado.");
  }
}

// Busca vários clientes de uma vez -> Map(id => cliente)
async function carregarClientes(db, ids) {
  const unicos = [...new Set(ids.filter(Boolean).map(String))];
  const mapa = new Map();

  if (unicos.length === 0) return mapa;

  const refs = unicos.map((id) => db.collection(COL_CLIENTES).doc(id));
  const docs = await db.getAll(...refs);

  for (const doc of docs) {
    if (doc.exists) mapa.set(doc.id, serializeCliente(doc.id, doc.data()));
  }

  return mapa;
}

// ============================================================
// Consultas
// ============================================================

// Datas bloqueadas para o calendário público (sem dados pessoais).
// Fonte da verdade: coleção diasReservados.
// Bloqueios com prazo vencido (sinal não pago em 24h) aparecem como livres.
export async function listarDatasOcupadas() {
  const db = getAdminDb();
  const snapshot = await db.collection(COL_DIAS).select("expiraEm").get();
  const agoraMs = Date.now();

  return snapshot.docs
    .filter((doc) => {
      const prazo = toMillis(doc.get("expiraEm"));
      return prazo === null || prazo > agoraMs;
    })
    .map((doc) => doc.id)
    .sort();
}

// Todas as reservas, mais recentes primeiro, com o cliente "populado"
// em customerId (mesmo formato do antigo populate do MongoDB).
// Campo extra "vencida": PENDING sem sinal com prazo de 24h estourado.
export async function listarReservas() {
  const db = getAdminDb();
  const snapshot = await db.collection(COL_RESERVAS).get();
  const agoraMs = Date.now();

  // Reservas antigas, criadas antes do código de acompanhamento, ganham um aqui.
  // Uma falha nessa etapa não pode impedir a listagem do painel.
  const tokensNovos = new Map();
  const semToken = snapshot.docs
    .filter((doc) => !doc.get("tokenAcompanhamento"))
    .slice(0, 400); // limite de segurança do batch do Firestore (500)

  if (semToken.length > 0) {
    try {
      const batch = db.batch();

      for (const doc of semToken) {
        const token = gerarTokenAcompanhamento();
        tokensNovos.set(doc.id, token);
        batch.update(doc.ref, { tokenAcompanhamento: token });
      }

      await batch.commit();
    } catch (err) {
      tokensNovos.clear();
      console.error("Falha ao gerar códigos de acompanhamento.", err?.message || err);
    }
  }

  const base = snapshot.docs.map((doc) => {
    const data = doc.data();
    const token = tokensNovos.get(doc.id);
    return serializeReserva(doc.id, token ? { ...data, tokenAcompanhamento: token } : data);
  });
  const clientes = await carregarClientes(db, base.map((r) => r.customerId));

  const reservas = base.map((reserva) => {
    const id = reserva.customerId ? String(reserva.customerId) : null;
    const cliente = id ? clientes.get(id) : null;

    return {
      ...reserva,
      vencida: estaVencida(reserva, agoraMs),
      customerId:
        cliente || (id ? { _id: id, id, nome: "(cliente não encontrado)" } : null),
    };
  });

  reservas.sort((a, b) =>
    String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
  );

  return reservas;
}

// Dados da página de acompanhamento do cliente, a partir do código secreto.
// Devolve SOMENTE o necessário para a página: nada de WhatsApp, e-mail,
// observações ou IDs internos. Retorna null se o código não existir.
export async function buscarAcompanhamento(token) {
  if (typeof token !== "string" || !TOKEN_REGEX.test(token)) return null;

  const db = getAdminDb();
  const snapshot = await db
    .collection(COL_RESERVAS)
    .where("tokenAcompanhamento", "==", token)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const reserva = snapshot.docs[0].data();

  let primeiroNome = "";

  if (reserva.customerId) {
    const clienteDoc = await db
      .collection(COL_CLIENTES)
      .doc(String(reserva.customerId))
      .get();

    if (clienteDoc.exists) {
      primeiroNome = String(clienteDoc.data().nome || "").trim().split(/\s+/)[0] || "";
    }
  }

  const valorTotal = Number(reserva.valorTotal || 0);
  const valorEntrada = Number(reserva.valorEntrada || 0);
  const entradaPaga = Boolean(reserva.entradaPaga);

  return {
    primeiroNome,
    dataReserva: reserva.dataReserva,
    horarioInicio: reserva.horarioInicio || HORARIO_INICIO,
    horarioFim: reserva.horarioFim || HORARIO_FIM,
    situacao: situacaoPublica(reserva),
    valorTotal,
    valorEntrada,
    valorRestante: Math.max(valorTotal - valorEntrada, 0),
    entradaPaga,
    // Só existe prazo enquanto a reserva está PENDING e sem sinal
    expiraEm: toISO(prazoEfetivo(reserva)),
  };
}

// ============================================================
// Criação
// ============================================================

// Cria uma reserva PENDING e bloqueia a data por 24h, atomicamente.
// Valores e horários são definidos AQUI, nunca pelo navegador.
// O cliente é identificado pelo WhatsApp normalizado (ID do documento).
// Se a data estiver presa por uma reserva vencida, ela é cancelada
// e a data passa para a nova reserva, na mesma transação.
export async function criarReserva({ nome, whatsapp, email = "", dataReserva, observacoes = "" }) {
  validarDataReserva(dataReserva);

  const nomeLimpo = String(nome || "").trim().slice(0, 100);
  const wpp = onlyDigits(whatsapp);
  const emailLimpo = String(email || "").trim().toLowerCase().slice(0, 150);
  const obs = String(observacoes || "").trim().slice(0, 500);

  if (!nomeLimpo) {
    throw new ReservaError("Informe o nome.");
  }

  if (!isValidBRPhone(wpp)) {
    throw new ReservaError("WhatsApp inválido. Use o formato 11999999999.");
  }

  if (!isValidEmail(emailLimpo)) {
    throw new ReservaError("E-mail inválido.");
  }

  const db = getAdminDb();
  const reservaRef = db.collection(COL_RESERVAS).doc();
  const diaRef = db.collection(COL_DIAS).doc(dataReserva);
  const clienteRef = db.collection(COL_CLIENTES).doc(wpp);
  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + PRAZO_SINAL_MS);

  const reserva = {
    customerId: wpp,
    dataReserva,
    horarioInicio: HORARIO_INICIO,
    horarioFim: HORARIO_FIM,
    status: STATUS.PENDING,
    valorEntrada: VALOR_ENTRADA,
    valorTotal: VALOR_TOTAL,
    entradaPaga: false,
    entradaPagaEm: null,
    expiraEm,
    tokenAcompanhamento: gerarTokenAcompanhamento(),
    observacoes: obs,
    createdAt: agora,
    updatedAt: agora,
  };

  await db.runTransaction(async (tx) => {
    // Leituras antes das gravações (regra do Firestore)
    const [diaDoc, clienteDoc] = await Promise.all([
      tx.get(diaRef),
      tx.get(clienteRef),
    ]);

    let reservaVencidaRef = null;

    if (diaDoc.exists) {
      const dia = diaDoc.data();
      const prazoDia = toMillis(dia.expiraEm);

      // Sem prazo (confirmada/paga/antiga) ou prazo ainda valendo -> ocupada
      if (prazoDia === null || prazoDia > agora.getTime()) {
        throw new ReservaError("Essa data já está reservada.", 409);
      }

      // Prazo vencido: confere na própria reserva antes de liberar
      if (dia.reservaId) {
        const antigaRef = db.collection(COL_RESERVAS).doc(String(dia.reservaId));
        const antigaDoc = await tx.get(antigaRef);

        if (antigaDoc.exists) {
          const antiga = antigaDoc.data();

          if (antiga.status !== STATUS.CANCELLED) {
            if (!estaVencida(antiga, agora.getTime())) {
              throw new ReservaError("Essa data já está reservada.", 409);
            }
            reservaVencidaRef = antigaRef;
          }
        }
      }
    }

    const cliente = {
      nome: nomeLimpo,
      whatsapp: wpp,
      updatedAt: agora,
    };

    // Só sobrescreve o e-mail se um novo foi informado
    if (emailLimpo) cliente.email = emailLimpo;

    if (!clienteDoc.exists) {
      cliente.createdAt = agora;
      cliente.email = emailLimpo;
    }

    if (reservaVencidaRef) {
      tx.update(reservaVencidaRef, {
        status: STATUS.CANCELLED,
        canceladaAutomaticamente: true,
        canceladaEm: agora,
        updatedAt: agora,
      });
    }

    tx.set(clienteRef, cliente, { merge: true });
    tx.create(reservaRef, reserva);
    tx.set(diaRef, {
      reservaId: reservaRef.id,
      dataReserva,
      expiraEm,
      createdAt: agora,
    });
  });

  // O código de acompanhamento volta só para quem acabou de criar a reserva,
  // para a tela de conclusão montar o link /reserva/<token>.
  return serializeReserva(reservaRef.id, reserva);
}

// ============================================================
// Ações administrativas
// ============================================================

// action: "CONFIRM" | "CANCEL" | "MARK_ENTRY_PAID" | "UNMARK_ENTRY_PAID" | "CONFIRM_ENTRY"
export async function atualizarReserva(id, action) {
  if (typeof id !== "string" || !id) {
    throw new ReservaError("ID da reserva inválido.");
  }

  if (!ACOES.includes(action)) {
    throw new ReservaError("Ação inválida.");
  }

  const db = getAdminDb();
  const reservaRef = db.collection(COL_RESERVAS).doc(id);

  const resultado = await db.runTransaction(async (tx) => {
    const reservaDoc = await tx.get(reservaRef);

    if (!reservaDoc.exists) {
      throw new ReservaError("Reserva não encontrada.", 404);
    }

    const reserva = reservaDoc.data();

    if (!parseDateISO(reserva.dataReserva)) {
      throw new ReservaError("Reserva com data inválida no banco.", 422);
    }

    const diaRef = db.collection(COL_DIAS).doc(reserva.dataReserva);
    const diaDoc = await tx.get(diaRef);
    const bloqueioEhDestaReserva = diaDoc.exists && diaDoc.data().reservaId === id;
    const agora = new Date();
    const updates = { updatedAt: agora };

    const confirmar = action === "CONFIRM" || action === "CONFIRM_ENTRY";
    const marcarEntrada = action === "MARK_ENTRY_PAID" || action === "CONFIRM_ENTRY";
    let recriarBloqueio = false;

    if (confirmar) {
      if (reserva.status === STATUS.CANCELLED) {
        throw new ReservaError("Não é possível confirmar uma reserva cancelada.", 409);
      }

      if (diaDoc.exists && !bloqueioEhDestaReserva) {
        throw new ReservaError("A data está bloqueada por outra reserva.", 409);
      }

      updates.status = STATUS.CONFIRMED;

      // Recria o bloqueio se estiver faltando (dados antigos/inconsistentes)
      if (!diaDoc.exists) recriarBloqueio = true;
    }

    if (marcarEntrada) {
      if (reserva.status === STATUS.CANCELLED) {
        throw new ReservaError("Não é possível registrar pagamento em reserva cancelada.", 409);
      }

      updates.entradaPaga = true;
      updates.entradaPagaEm = reserva.entradaPagaEm || agora;
    }

    if (action === "CANCEL") {
      updates.status = STATUS.CANCELLED;
      updates.canceladaEm = agora;
    }

    if (action === "UNMARK_ENTRY_PAID") {
      updates.entradaPaga = false;
      updates.entradaPagaEm = null;
    }

    const final = { ...reserva, ...updates };

    // Mantém o prazo do bloqueio igual ao da reserva:
    // confirmada ou paga -> sem prazo; PENDING sem sinal -> expiraEm da reserva.
    if (action === "CANCEL") {
      // Só libera a data se o bloqueio pertencer a esta reserva
      if (bloqueioEhDestaReserva) tx.delete(diaRef);
    } else if (recriarBloqueio) {
      tx.create(diaRef, {
        reservaId: id,
        dataReserva: reserva.dataReserva,
        expiraEm: prazoEfetivo(final),
        createdAt: agora,
      });
    } else if (bloqueioEhDestaReserva) {
      tx.update(diaRef, { expiraEm: prazoEfetivo(final) });
    }

    tx.update(reservaRef, updates);

    return final;
  });

  return serializeReserva(id, resultado);
}

// ============================================================
// Exclusão definitiva (somente reservas canceladas)
// ============================================================

// Apaga do banco uma reserva CANCELADA, para limpar o painel.
// Reservas pendentes ou confirmadas nunca são excluídas: primeiro é preciso cancelar.
export async function excluirReserva(id) {
  if (typeof id !== "string" || !id) {
    throw new ReservaError("ID da reserva inválido.");
  }

  const db = getAdminDb();
  const reservaRef = db.collection(COL_RESERVAS).doc(id);

  await db.runTransaction(async (tx) => {
    const reservaDoc = await tx.get(reservaRef);

    if (!reservaDoc.exists) {
      throw new ReservaError("Reserva não encontrada.", 404);
    }

    const reserva = reservaDoc.data();

    if (reserva.status !== STATUS.CANCELLED) {
      throw new ReservaError("Só é possível excluir reservas canceladas.", 409);
    }

    // Por segurança: se ainda existir um bloqueio da data apontando para esta
    // reserva (dado inconsistente), ele é removido junto.
    let diaRef = null;
    let diaDoc = null;

    if (parseDateISO(reserva.dataReserva)) {
      diaRef = db.collection(COL_DIAS).doc(reserva.dataReserva);
      diaDoc = await tx.get(diaRef);
    }

    if (diaDoc && diaDoc.exists && diaDoc.data().reservaId === id) {
      tx.delete(diaRef);
    }

    tx.delete(reservaRef);
  });

  return { id };
}

// ============================================================
// Limpeza de reservas vencidas
// ============================================================

// Cancela as reservas PENDING sem sinal com prazo vencido e libera as datas.
// Ainda não é chamada por ninguém: será usada pelo Cron diário (passo 5).
// O calendário já trata bloqueios vencidos como livres mesmo sem ela.
export async function liberarReservasVencidas() {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COL_RESERVAS)
    .where("status", "==", STATUS.PENDING)
    .get();

  const candidatas = snapshot.docs.filter((doc) => estaVencida(doc.data()));
  let liberadas = 0;

  for (const doc of candidatas) {
    const cancelou = await db.runTransaction(async (tx) => {
      const atualDoc = await tx.get(doc.ref);
      if (!atualDoc.exists) return false;

      const reserva = atualDoc.data();
      if (!estaVencida(reserva)) return false;

      const diaRef = parseDateISO(reserva.dataReserva)
        ? db.collection(COL_DIAS).doc(reserva.dataReserva)
        : null;
      const diaDoc = diaRef ? await tx.get(diaRef) : null;
      const agora = new Date();

      tx.update(doc.ref, {
        status: STATUS.CANCELLED,
        canceladaAutomaticamente: true,
        canceladaEm: agora,
        updatedAt: agora,
      });

      if (diaDoc && diaDoc.exists && diaDoc.data().reservaId === doc.id) {
        tx.delete(diaRef);
      }

      return true;
    });

    if (cancelou) liberadas += 1;
  }

  return { liberadas };
}

// ============================================================
// Helper para as APIs: converte erro em resposta HTTP
// ============================================================
export function responderErro(res, err, mensagemPadrao = "Erro interno.") {
  if (err instanceof ReservaError) {
    return res.status(err.statusCode).json({ ok: false, error: err.message });
  }

  console.error(mensagemPadrao, err?.message || err);
  return res.status(500).json({ ok: false, error: mensagemPadrao });
}