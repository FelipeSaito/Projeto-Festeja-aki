import styles from "./Header.module.css";
export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.logo}>Festeja Aki</div>

        <div className={styles.actions}>
          <a href="#sobre" className={styles.secondary}>
            Sobre Nós
          </a>

          <a href="#contato" className={styles.primary}>
            Contato
          </a>
        </div>
      </div>
    </header>
  );
}