// pages/api/auth/login.js
// Login do administrador: confere e-mail e senha e grava o cookie de sessão.
import crypto from "crypto";
import { serialize } from "cookie";
import { COOKIE_NAME, SESSAO_SEGUNDOS, signAdminToken } from "../../../lib/auth";

// Compara dois textos em tempo constante, para não dar pistas sobre a senha
function iguais(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  const { email, password } = req.body || {};

  const envEmail = process.env.ADMIN_EMAIL;
  const envPass = process.env.ADMIN_PASSWORD;
  const secret = process.env.JWT_SECRET;

  if (!envEmail || !envPass || !secret) {
    // O detalhe fica só no log do servidor, sem nenhum valor
    console.error("Login indisponível: variáveis de ambiente do admin não configuradas.");
    return res.status(500).json({ ok: false, error: "Login indisponível no momento." });
  }

  const okEmail = iguais(
    String(email || "").trim().toLowerCase(),
    String(envEmail).trim().toLowerCase()
  );
  const okPass = iguais(String(password || ""), String(envPass));

  if (!okEmail || !okPass) {
    return res.status(401).json({ ok: false, error: "Credenciais inválidas." });
  }

  const token = signAdminToken({ role: "admin", email: envEmail });

  res.setHeader(
    "Set-Cookie",
    serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSAO_SEGUNDOS,
    })
  );

  return res.status(200).json({ ok: true });
}