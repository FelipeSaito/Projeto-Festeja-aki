import { serialize } from "cookie";
import { COOKIE_NAME, signAdminToken } from "../../../lib/auth";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { email, password } = req.body || {};

  const envEmail = process.env.ADMIN_EMAIL;
  const envPass = process.env.ADMIN_PASSWORD;
  const secret = process.env.JWT_SECRET;

  // ✅ DEBUG (deixa por 1 teste, depois remove)
  console.log("LOGIN attempt:", { email, hasPass: !!password });
  console.log("ENV:", { envEmail, hasEnvPass: !!envPass, hasSecret: !!secret });

  if (!envEmail || !envPass || !secret) {
    return res.status(500).json({
      ok: false,
      error: "Faltando ADMIN_EMAIL/ADMIN_PASSWORD/JWT_SECRET no .env.local",
    });
  }

  const okEmail = String(email || "").trim().toLowerCase() === String(envEmail).trim().toLowerCase();
  const okPass = String(password || "") === String(envPass);

  console.log("CHECK:", { okEmail, okPass });

  if (!okEmail || !okPass) {
    return res.status(401).json({ ok: false, error: "Credenciais inválidas." });
  }

  const token = signAdminToken({ role: "admin", email: envEmail });

  res.setHeader(
    "Set-Cookie",
    serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2,
    })
  );

  return res.status(200).json({ ok: true });
}