// lib/firebaseAdmin.js
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Remove espaços e aspas que podem vir junto quando o valor é copiado do .env
function limpar(valor) {
  return valor?.trim().replace(/^["']|["']$/g, "");
}

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = limpar(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = limpar(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = limpar(process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Credenciais Firebase não configuradas.");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}