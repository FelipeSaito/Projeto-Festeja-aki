import jwt from "jsonwebtoken";
import { parse } from "cookie";

export const COOKIE_NAME = "fa_token";

export function signAdminToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "2h" });
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
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
  } catch (e) {
    res.status(401).json({ ok: false, error: "Token inválido/expirado" });
    return null;
  }
}