
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

   const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ?.trim()
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n"); 

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
