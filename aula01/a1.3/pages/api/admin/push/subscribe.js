// pages/api/admin/push/subscribe.js
// API ADMIN: guarda (POST) ou remove (DELETE) a inscrição de notificações
// do aparelho que está usando o painel. GET devolve só a contagem (diagnóstico).
import crypto from "crypto";
import { requireAdminCookie } from "../../../../lib/auth";
import { getAdminDb } from "../../../../lib/firebaseAdmin";

const COL_INSCRICOES = "inscricoesPush";

// O endereço da inscrição é longo; o ID do documento é um resumo dele.
function idDaInscricao(endpoint) {
  return crypto.createHash("sha256").update(endpoint).digest("hex");
}

function endpointValido(endpoint) {
  if (typeof endpoint !== "string" || endpoint.length > 2000) return false;

  try {
    return new URL(endpoint).protocol === "https:";
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const admin = requireAdminCookie(req, res);
  if (!admin) return;

  try {
    const db = getAdminDb();

    // Diagnóstico: quantos aparelhos estão inscritos e em qual banco.
    // "banco" é só uma impressão digital do projeto, para comparar ambientes.
    if (req.method === "GET") {
      const snapshot = await db.collection(COL_INSCRICOES).select().get();
      const projeto = String(process.env.FIREBASE_PROJECT_ID || "")
        .trim()
        .replace(/^["']|["']$/g, "");

      return res.status(200).json({
        ok: true,
        inscritos: snapshot.size,
        banco: crypto.createHash("sha256").update(projeto).digest("hex").slice(0, 8),
      });
    }

    if (req.method === "POST") {
      const { endpoint, keys } = req.body || {};
      const p256dh = keys?.p256dh;
      const auth = keys?.auth;

      if (
        !endpointValido(endpoint) ||
        typeof p256dh !== "string" ||
        typeof auth !== "string" ||
        p256dh.length > 300 ||
        auth.length > 300
      ) {
        return res.status(400).json({ ok: false, error: "Inscrição inválida." });
      }

      const ref = db.collection(COL_INSCRICOES).doc(idDaInscricao(endpoint));
      const atual = await ref.get();
      const agora = new Date();

      const dados = {
        endpoint,
        keys: { p256dh, auth },
        aparelho: String(req.headers["user-agent"] || "").slice(0, 300),
        updatedAt: agora,
      };

      if (!atual.exists) dados.createdAt = agora;

      await ref.set(dados, { merge: true });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { endpoint } = req.body || {};

      if (!endpointValido(endpoint)) {
        return res.status(400).json({ ok: false, error: "Inscrição inválida." });
      }

      await db.collection(COL_INSCRICOES).doc(idDaInscricao(endpoint)).delete();
      console.log("Inscrição de notificações removida a pedido do aparelho.");
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  } catch (err) {
    console.error("Erro ao salvar inscrição de notificações.", err?.message || err);
    return res
      .status(500)
      .json({ ok: false, error: "Erro ao salvar inscrição de notificações." });
  }
}