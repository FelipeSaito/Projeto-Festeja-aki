// pages/_app.js
import { useEffect } from "react";
import { Poppins } from "next/font/google";
import "../styles/globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "700"], // normal + bold
});

export default function MyApp({ Component, pageProps }) {
  // Registra o service worker (necessário para instalar o app e receber notificações)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Falha ao registrar o service worker:", err?.message || err);
    });
  }, []);

  return (
    <main className={poppins.className}>
      <Component {...pageProps} />
    </main>
  );
}