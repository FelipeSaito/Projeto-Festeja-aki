// pages/api/test-firebase.js
// Diagnóstico: confere se o servidor consegue ler o Firestore.
// Só responde ao administrador logado e não devolve nenhum valor de configuração.
import { getAdminDb } from "../../lib/firebaseAdmin";
import { requireAdminCookie } from "../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      ok: false,
      error: "Método não permitido",
    });
  }

  const admin = requireAdminCookie(req, res);
  if (!admin) return;

  try {
    // Usa a mesma inicialização do restante do sistema (lib/firebaseAdmin.js)
    const db = getAdminDb();

    await db.collection("reservas").limit(1).get();

    return res.status(200).json({
      ok: true,
      message: "Firebase conectado com sucesso!",
    });
  } catch (error) {
    console.error("Erro Firebase:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
    });

    return res.status(500).json({
      ok: false,
      error: "Falha ao conectar com Firebase",
    });
  }
}