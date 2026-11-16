// pages/admin/perfil.js
// Tela "Quem está usando?": escolha do perfil e conferência do PIN.
// Aparece na primeira vez em cada aparelho; depois o aparelho lembra o perfil.
import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import styles from "../../styles/adminPerfil.module.css";

const TAMANHO_PIN = 4;
const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function AdminPerfilPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [perfis, setPerfis] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        const res = await fetch("/api/auth/perfis", { credentials: "include" });

        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }

        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.ok) throw new Error(j?.error || "Erro ao carregar os perfis");

        if (!cancelado) setPerfis(Array.isArray(j.perfis) ? j.perfis : []);
      } catch (err) {
        if (!cancelado) setErro(err.message);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [router]);

  async function enviar(pinCompleto) {
    if (!selecionado || enviando) return;

    setEnviando(true);
    setErro("");

    try {
      const res = await fetch("/api/auth/perfis", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfilId: selecionado.id, pin: pinCompleto }),
      });

      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }

      const j = await res.json().catch(() => ({}));

      if (!res.ok || !j.ok) {
        setPin("");
        setErro(j?.error || "Não foi possível entrar.");
        return;
      }

      window.location.href = "/admin/reservas";
    } catch {
      setPin("");
      setErro("Erro ao conectar.");
    } finally {
      setEnviando(false);
    }
  }

  function digitar(numero) {
    if (enviando || pin.length >= TAMANHO_PIN) return;

    const novo = pin + numero;
    setPin(novo);
    setErro("");

    if (novo.length === TAMANHO_PIN) enviar(novo);
  }

  function apagar() {
    if (enviando) return;
    setPin((atual) => atual.slice(0, -1));
  }

  function voltar() {
    setSelecionado(null);
    setPin("");
    setErro("");
  }

  // Teclado físico: números, Backspace e Esc
  useEffect(() => {
    if (!selecionado) return undefined;

    function aoTeclar(event) {
      if (/^\d$/.test(event.key)) digitar(event.key);
      else if (event.key === "Backspace") apagar();
      else if (event.key === "Escape") voltar();
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado, pin, enviando]);

  return (
    <div className={styles.wrapper}>
      <Head>
        <title>Perfil · Festeja Aki</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0e4450" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Festeja Aki" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {!selecionado ? (
        <div className={styles.conteudo}>
          <h1 className={styles.titulo}>Quem está usando?</h1>

          {carregando ? (
            <p className={styles.texto}>Carregando perfis...</p>
          ) : (
            <div className={styles.perfis}>
              {perfis.map((perfil) => (
                <button
                  key={perfil.id}
                  type="button"
                  className={styles.perfil}
                  onClick={() => {
                    setSelecionado(perfil);
                    setPin("");
                    setErro("");
                  }}
                  disabled={!perfil.configurado}
                >
                  <span className={styles.avatar} style={{ background: perfil.cor }}>
                    {perfil.nome.charAt(0)}
                  </span>
                  <span className={styles.nome}>{perfil.nome}</span>
                  {!perfil.configurado && (
                    <span className={styles.aviso}>PIN não configurado</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {erro && (
            <p className={styles.erro} role="alert">
              {erro}
            </p>
          )}
        </div>
      ) : (
        <div className={styles.conteudo}>
          <span
            className={`${styles.avatar} ${styles.avatarMenor}`}
            style={{ background: selecionado.cor }}
          >
            {selecionado.nome.charAt(0)}
          </span>

          <h1 className={styles.titulo}>Olá, {selecionado.nome}</h1>
          <p className={styles.texto}>Digite o seu PIN de {TAMANHO_PIN} dígitos.</p>

          <div
            className={styles.pontos}
            role="img"
            aria-label={`${pin.length} de ${TAMANHO_PIN} dígitos digitados`}
          >
            {Array.from({ length: TAMANHO_PIN }, (_, i) => (
              <span
                key={i}
                className={`${styles.ponto} ${i < pin.length ? styles.pontoCheio : ""}`}
              />
            ))}
          </div>

          <p className={styles.erro} role="alert">
            {erro}
          </p>

          <div className={styles.teclado}>
            {TECLAS.map((tecla) => (
              <button
                key={tecla}
                type="button"
                className={styles.tecla}
                onClick={() => digitar(tecla)}
                disabled={enviando}
              >
                {tecla}
              </button>
            ))}

            <button type="button" className={styles.teclaTexto} onClick={voltar}>
              Voltar
            </button>

            <button
              type="button"
              className={styles.tecla}
              onClick={() => digitar("0")}
              disabled={enviando}
            >
              0
            </button>

            <button
              type="button"
              className={styles.teclaTexto}
              onClick={apagar}
              disabled={enviando || pin.length === 0}
            >
              Apagar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}