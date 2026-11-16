// lib/perfilService.js
// Perfis do painel (quem está usando o aparelho) e a conferência do PIN.
// Roda SOMENTE no servidor. Nunca importe em páginas.
//
// O perfil identifica a pessoa; quem protege o painel continua sendo o login
// com e-mail e senha (lib/auth.js). Por isso o PIN só é aceito de quem já está logado.
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { parse, serialize } from "cookie";

export const COOKIE_PERFIL = "fa_perfil";

// O aparelho lembra o perfil escolhido por um ano
const PERFIL_SEGUNDOS = 365 * 24 * 60 * 60;

// Para adicionar ou renomear um perfil, edite apenas esta lista.
// O PIN de cada um fica na variável de ambiente indicada em "envPin" (4 dígitos).
export const PERFIS = [
  { id: "felipe", nome: "Felipe", cor: "#17616f", envPin: "PIN_FELIPE" },
  { id: "marcio", nome: "Marcio", cor: "#d92b2b", envPin: "PIN_MARCIO" },
];

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não definido");
  return secret;
}

// Compara dois textos em tempo constante, para não dar pistas sobre o PIN
function iguais(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// PIN configurado para o perfil, ou null se faltar ou não tiver 4 dígitos
function pinDoPerfil(perfil) {
  const valor = String(process.env[perfil.envPin] || "")
    .trim()
    .replace(/^["']|["']$/g, "");

  return /^\d{4}$/.test(valor) ? valor : null;
}

function publico(perfil) {
  return { id: perfil.id, nome: perfil.nome, cor: perfil.cor };
}

// Lista para a tela de escolha (sem os PINs)
export function listarPerfis() {
  return PERFIS.map((perfil) => ({
    ...publico(perfil),
    configurado: pinDoPerfil(perfil) !== null,
  }));
}

// Devolve o perfil se o PIN estiver certo; senão, null
export function conferirPin(perfilId, pin) {
  const perfil = PERFIS.find((p) => p.id === perfilId);
  if (!perfil) return null;

  const certo = pinDoPerfil(perfil);
  if (!certo) return null;

  return iguais(String(pin || ""), certo) ? publico(perfil) : null;
}

// Cabeçalho Set-Cookie que grava o perfil escolhido neste aparelho
export function cookieDoPerfil(perfilId) {
  const token = jwt.sign({ perfil: perfilId }, getSecret(), {
    algorithm: "HS256",
    expiresIn: PERFIL_SEGUNDOS,
  });

  return serialize(COOKIE_PERFIL, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PERFIL_SEGUNDOS,
  });
}

// Perfil gravado no aparelho que fez a requisição, ou null
export function perfilDoReq(req) {
  try {
    const token = parse(req.headers.cookie || "")[COOKIE_PERFIL];
    if (!token) return null;

    const payload = jwt.verify(token, getSecret(), { algorithms: ["HS256"] });
    const perfil = PERFIS.find((p) => p.id === payload?.perfil);

    return perfil ? publico(perfil) : null;
  } catch {
    return null;
  }
}