// components/AdminLayout.js
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import styles from "../styles/admin.module.css";

const LINKS = [
  { href: "/admin/reservas", label: "Reservas", icon: "reservas" },
  { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/metrics", label: "Métricas", icon: "metricas" },
];

function Icone({ nome }) {
  const comum = {
    className: styles.navIcon,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (nome === "reservas") {
    return (
      <svg {...comum}>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    );
  }

  if (nome === "dashboard") {
    return (
      <svg {...comum}>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="8" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
        <rect x="13" y="13" width="8" height="8" rx="2" />
      </svg>
    );
  }

  if (nome === "metricas") {
    return (
      <svg {...comum}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    );
  }

  // sair
  return (
    <svg {...comum}>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9" />
    </svg>
  );
}

export default function AdminLayout({
  title = "Admin",
  subtitle = "Gerencie suas reservas com rapidez.",
  children,
}) {
  const router = useRouter();

  async function sair() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // mesmo se a chamada falhar, volta para a tela de login
    }

    router.push("/admin/login");
  }

  return (
    <div className={styles.shell}>
      {/* PWA: só as páginas do painel são "instaláveis" como app */}
      <Head>
        <title>{`${title} · Festeja Aki`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#fbfd2e" />

        {/* iPhone (Safari → Compartilhar → Adicionar à Tela de Início) */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Festeja Aki" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/* O painel não deve aparecer no Google */}
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.logo} src="/icons/icon-192.png" alt="" />
          <div>
            <strong>Festeja Aki</strong>
            <div className={styles.sub}>Painel do salão</div>
          </div>
        </div>

        <nav className={styles.nav} aria-label="Menu do painel">
          {LINKS.map((link) => {
            const ativo = router.pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.navItem} ${ativo ? styles.navItemActive : ""}`}
                aria-current={ativo ? "page" : undefined}
              >
                <Icone nome={link.icon} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <button type="button" className={styles.logout} onClick={sair}>
            <Icone nome="sair" />
            Sair
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.headerLogo} src="/icons/icon-192.png" alt="" />
          <div>
            <h1 className={styles.h1}>{title}</h1>
            {subtitle && <p className={styles.p}>{subtitle}</p>}
          </div>
        </header>

        <section className={styles.content}>{children}</section>
      </main>
    </div>
  );
}