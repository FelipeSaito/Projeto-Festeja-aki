// components/BotaoNotificacoes.js
// Botão do painel para ativar ou desativar as notificações neste aparelho.
import { useEffect, useState } from "react";
import styles from "../styles/admin.module.css";

const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

// A chave pública vem em texto (base64url) e o navegador pede em bytes
function chaveEmBytes(base64url) {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const texto = window.atob(base64);
  const bytes = new Uint8Array(texto.length);

  for (let i = 0; i < texto.length; i += 1) bytes[i] = texto.charCodeAt(i);
  return bytes;
}

function ehIphoneForaDoApp() {
  const ios = /iPhone|iPad|iPod/.test(window.navigator.userAgent);
  const instalado =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  return ios && !instalado;
}

export default function BotaoNotificacoes() {
  // "verificando" | "indisponivel" | "inativo" | "ativo"
  const [estado, setEstado] = useState("verificando");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let cancelado = false;

    async function verificar() {
      const suportado =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

      if (!suportado) {
        if (cancelado) return;
        setEstado("indisponivel");
        setAviso(
          ehIphoneForaDoApp()
            ? "No iPhone, adicione o painel à Tela de Início e abra por lá para ativar as notificações."
            : "Este navegador não recebe notificações."
        );
        return;
      }

      try {
        const registro = await navigator.serviceWorker.ready;
        const inscricao = await registro.pushManager.getSubscription();
        if (!cancelado) setEstado(inscricao ? "ativo" : "inativo");
      } catch {
        if (!cancelado) setEstado("inativo");
      }
    }

    verificar();

    return () => {
      cancelado = true;
    };
  }, []);

  async function ativar() {
    setAviso("");

    if (!CHAVE_PUBLICA) {
      setAviso("Falta configurar a chave de notificações (NEXT_PUBLIC_VAPID_PUBLIC_KEY).");
      return;
    }

    setOcupado(true);

    try {
      const permissao = await Notification.requestPermission();

      if (permissao !== "granted") {
        setAviso(
          "As notificações estão bloqueadas para este site. Libere nas configurações do navegador e tente de novo."
        );
        return;
      }

      const registro = await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveEmBytes(CHAVE_PUBLICA),
      });

      const resp = await fetch("/api/admin/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inscricao.toJSON()),
      });

      const j = await resp.json().catch(() => ({}));

      if (!resp.ok || !j.ok) {
        // Não deixa o aparelho inscrito sem o servidor saber
        await inscricao.unsubscribe().catch(() => {});
        throw new Error(j?.error || "Não foi possível salvar a inscrição.");
      }

      setEstado("ativo");
    } catch (err) {
      setAviso(err?.message || "Não foi possível ativar as notificações.");
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setAviso("");
    setOcupado(true);

    try {
      const registro = await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.getSubscription();

      if (inscricao) {
        await fetch("/api/admin/push/subscribe", {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: inscricao.endpoint }),
        }).catch(() => {});

        await inscricao.unsubscribe();
      }

      setEstado("inativo");
    } catch (err) {
      setAviso(err?.message || "Não foi possível desativar as notificações.");
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "verificando") return null;

  return (
    <div className={styles.rightTools}>
      {estado === "inativo" && (
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={ativar}
          disabled={ocupado}
        >
          {ocupado ? "Ativando..." : "Ativar notificações"}
        </button>
      )}

      {estado === "ativo" && (
        <>
          <small className={styles.entryHint}>Notificações ativas neste aparelho.</small>
          <button
            type="button"
            className={styles.btnUndo}
            onClick={desativar}
            disabled={ocupado}
          >
            {ocupado ? "Desativando..." : "Desativar"}
          </button>
        </>
      )}

      {aviso && (
        <small className={styles.entryHint} role="status">
          {aviso}
        </small>
      )}
    </div>
  );
}