// pages/admin/login.js
import { useState } from "react";
import Head from "next/head";
import styles from "../../styles/adminLogin.module.css";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const j = await res.json();

      if (!res.ok) {
        setMsg(j?.error || "Erro ao logar.");
        return;
      }

      window.location.href = "/admin/reservas";
    } catch {
      setMsg("Erro ao conectar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* PWA: mesmas tags do AdminLayout, para o app poder ser instalado a partir do login */}
      <Head>
        <title>Entrar · Festeja Aki</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#fbfd2e" />

        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Festeja Aki" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className={styles.card}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.logo} src="/icons/icon-512.png" alt="Festeja Aki" />

        <h1>Painel do salão</h1>

        <form onSubmit={onSubmit}>
          <label className={styles.field}>
            <span>E-mail</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {msg && (
          <p className={styles.msg} role="alert">
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}