import Link from "next/link";
import styles from "../styles/admin.module.css";

export default function AdminLayout({ title = "Admin", children }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.logo}>🏛️</div>
          <div>
            <strong>Painel</strong>
            <div className={styles.sub}>Salão de Festas</div>
          </div>
        </div>

        <nav className={styles.nav}>
          <Link className={styles.navItem} href="/admin/reservas">Reservas</Link>
          <Link className={styles.navItem} href="/admin/dashboard">Dashboard</Link>
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.logout}>Sair</button>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.h1}>{title}</h1>
            <p className={styles.p}>Gerencie suas reservas com rapidez.</p>
          </div>
        </header>

        <section className={styles.content}>{children}</section>
      </main>
    </div>
  );
}