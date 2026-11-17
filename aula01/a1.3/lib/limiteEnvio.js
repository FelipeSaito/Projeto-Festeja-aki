// lib/limiteEnvio.js
// Limite de pedidos de reserva por endereço IP, para o formulário público.
// Impede que alguém trave várias datas (e dispare várias notificações) em sequência.
// Roda SOMENTE no servidor (usa o Firebase Admin SDK). Nunca importe em páginas.
import crypto from "crypto";
import { getAdminDb } from "./firebaseAdmin";
import { toMillis } from "./reservasService";

const COL_LIMITES = "limitesEnvio";

// Para ajustar os limites, edite apenas aqui.
export const JANELA_MINUTOS = 60;
export const MAX_RESERVAS_POR_JANELA = 3; // reservas criadas por IP a cada janela
export const MAX_TENTATIVAS_POR_JANELA = 20; // envios do formulário (com erro ou não)

const JANELA_MS = JANELA_MINUTOS * 60 * 1000;

// IP de quem enviou o formulário.
// Na Vercel, "x-real-ip" e "x-forwarded-for" são preenchidos pela própria plataforma.
export function ipDoPedido(req) {
  const real = req.headers["x-real-ip"];
  if (real) return String(Array.isArray(real) ? real[0] : real).trim();

  const encaminhado = req.headers["x-forwarded-for"];
  const primeiro = String(Array.isArray(encaminhado) ? encaminhado[0] : encaminhado || "")
    .split(",")[0]
    .trim();

  return primeiro || req.socket?.remoteAddress || "desconhecido";
}

// O IP não é gravado no banco: guardamos só um código derivado dele.
function chaveDoIp(ip) {
  return crypto
    .createHash("sha256")
    .update(`${process.env.JWT_SECRET || ""}:${ip}`)
    .digest("hex")
    .slice(0, 40);
}

// Registra um envio do formulário e reserva uma "vaga" de criação para este IP.
// Retorna { permitido, chave }. Se a reserva não for criada, chame devolverVaga(chave).
export async function registrarTentativa(ip) {
  const db = getAdminDb();
  const chave = chaveDoIp(ip);
  const ref = db.collection(COL_LIMITES).doc(chave);

  const permitido = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const agora = new Date();

    let inicioJanela = agora;
    let tentativas = 0;
    let reservas = 0;

    if (doc.exists) {
      const dados = doc.data();
      const inicioMs = toMillis(dados.inicioJanela);

      // Dentro da janela atual: continua a contagem. Fora dela: começa do zero.
      if (inicioMs !== null && agora.getTime() - inicioMs < JANELA_MS) {
        inicioJanela = dados.inicioJanela;
        tentativas = Number(dados.tentativas || 0);
        reservas = Number(dados.reservas || 0);
      }
    }

    if (tentativas >= MAX_TENTATIVAS_POR_JANELA) return false;

    tentativas += 1;

    const liberado = reservas < MAX_RESERVAS_POR_JANELA;
    if (liberado) reservas += 1;

    tx.set(ref, { inicioJanela, tentativas, reservas, updatedAt: agora });

    return liberado;
  });

  return { permitido, chave };
}

// Devolve a vaga quando a reserva não chegou a ser criada
// (dados inválidos, data já ocupada, erro interno).
export async function devolverVaga(chave) {
  if (!chave) return;

  const db = getAdminDb();
  const ref = db.collection(COL_LIMITES).doc(chave);

  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) return;

    const reservas = Number(doc.data().reservas || 0);
    if (reservas > 0) tx.update(ref, { reservas: reservas - 1, updatedAt: new Date() });
  });
}