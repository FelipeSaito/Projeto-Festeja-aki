import { useState } from "react";
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
      <div className={styles.card}>
        <h1>Painel Administrativo</h1>

        <form onSubmit={onSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {msg && <p>{msg}</p>}
      </div>
    </div>
  );
}