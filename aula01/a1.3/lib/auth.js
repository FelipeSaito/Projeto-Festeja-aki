// lib/auth.js
import jwt from "jsonwebtoken";
import { parse } from "cookie";

export const COOKIE_NAME = "fa_token";

// Duração da sessão do painel. Para mudar o prazo, altere só o número de dias:
// o token e o cookie usam este mesmo valor.
export const SESSAO_DIAS = 30;
export const SESSAO_SEGUNDOS = SESSAO_DIAS * 24 * 60 * 60;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não definido");
  return secret;
}

export function signAdminToken(payload) {
  return jwt.sign(payload, getSecret(), {
    algorithm: "HS256",
    expiresIn: SESSAO_SEGUNDOS,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret(), { algorithms: ["HS256"] });
}

export function getTokenFromReq(req) {
  const cookies = parse(req.headers.cookie || "");
  return cookies[COOKIE_NAME];
}

export function requireAdminCookie(req, res) {
  try {
    const token = getTokenFromReq(req);

    if (!token) {
      res.status(401).json({ ok: false, error: "Não autenticado" });
      return null;
    }

    const payload = verifyToken(token);

    if (payload?.role !== "admin") {
      res.status(403).json({ ok: false, error: "Sem permissão" });
      return null;
    }

    return payload;
  } catch (err) {
    res.status(401).json({ ok: false, error: "Token inválido ou expirado" });
    return null;
  }
}