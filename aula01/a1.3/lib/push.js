// lib/push.js
// Envia notificações para os aparelhos inscritos no painel (coleção inscricoesPush).
// Roda SOMENTE no servidor. Nunca importe em páginas.
import { setVapidDetails, sendNotification } from "web-push";
import { getAdminDb } from "./firebaseAdmin";

const COL_INSCRICOES = "inscricoesPush";

let configurado = false;

// Remove espaços e aspas que podem vir junto quando o valor é copiado do .env
function limpar(valor) {
  return valor?.trim().replace(/^["']|["']$/g, "");
}

function configurar() {
  if (configurado) return true;

  const chavePublica = limpar(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const chavePrivada = limpar(process.env.VAPID_PRIVATE_KEY);
  const email = limpar(process.env.ADMIN_EMAIL);

  if (!chavePublica || !chavePrivada || !email) return false;

  setVapidDetails(`mailto:${email}`, chavePublica, chavePrivada);
  configurado = true;
  return true;
}

// Envia o aviso para todos os aparelhos inscritos.
// Inscrições que não existem mais (app desinstalado, permissão retirada) são apagadas.
export async function enviarNotificacao({ title, body, url = "/admin/reservas" }) {
  if (!configurar()) {
    console.error("Notificações não configuradas: faltam as chaves ou o e-mail do admin.");
    return { enviadas: 0, falhas: 0 };
  }

  const db = getAdminDb();
  const snapshot = await db.collection(COL_INSCRICOES).get();
  const payload = JSON.stringify({ title, body, url });

  let enviadas = 0;
  let falhas = 0;

  await Promise.all(
    snapshot.docs.map(async (doc) => {
      const { endpoint, keys } = doc.data();

      try {
        await sendNotification({ endpoint, keys }, payload, {
          TTL: 60 * 60 * 24,
          urgency: "high",
        });
        enviadas += 1;
      } catch (err) {
        falhas += 1;

        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await doc.ref.delete().catch(() => {});
        } else {
          console.error("Falha ao enviar notificação.", err?.statusCode || err?.message || err);
        }
      }
    })
  );

  return { enviadas, falhas };
}