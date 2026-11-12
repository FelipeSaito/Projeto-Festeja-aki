
import { createPrivateKey } from "node:crypto";
import { getAdminDb } from "../../lib/firebaseAdmin";
import { requireAdminCookie } from "../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Método não permitido",
    });
  }

  const admin = requireAdminCookie(req, res);
  if (!admin) return;

  try {
    const privateKey = (
      process.env.FIREBASE_PRIVATE_KEY || ""
    )
      .trim()
      .replace(/\\n/g, "\n");

    createPrivateKey(privateKey);

    console.log("Diagnóstico Firebase:", {
      chaveValida: true,
      projetoConfigurado: Boolean(process.env.FIREBASE_PROJECT_ID),
      emailConfigurado: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    });

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
