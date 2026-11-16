// pages/api/auth/perfis.js
// Perfis do painel. Só responde a quem já entrou com e-mail e senha.
// GET  -> lista os perfis e diz qual está gravado neste aparelho.
// POST -> confere o PIN e grava o perfil neste aparelho.
import { requireAdminCookie } from "../../../lib/auth";
import {
  listarPerfis,
  conferirPin,
  cookieDoPerfil,
  perfilDoReq,
} from "../../../lib/perfilService";

export default function handler(req, res) {
  const admin = requireAdminCookie(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      perfis: listarPerfis(),
      atual: perfilDoReq(req),
    });
  }

  if (req.method === "POST") {
    const { perfilId, pin } = req.body || {};
    const perfil = conferirPin(perfilId, pin);

    if (!perfil) {
      return res.status(403).json({ ok: false, error: "PIN incorreto." });
    }

    res.setHeader("Set-Cookie", cookieDoPerfil(perfil.id));
    return res.status(200).json({ ok: true, atual: perfil });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Método não permitido" });
}