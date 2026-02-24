import Image from "next/image";
import Link from "next/link";
import Header from "./components/Header";
import styles from "../styles/Home.module.css";

export default function HomePage() {
  return (
    <>
      <Header />

      <section className={styles.hero}>
        <Image
          src="/images/background.png"
          alt="Festeja Aki"
          fill
          priority
          className={styles.bg}
        />

        <div className={styles.overlay} />

        <div className={styles.content}>
          <h1 className={styles.title}>
            <span className={styles.wordCycle} aria-label="Transforme, Celebre, Viva">
              <span>TRANSFORME</span>
              <span>REALIZEM</span>
              <span>APROVEITEM</span>
            </span>{" "}
            MOMENTOS ESPECIAIS
            <br />
            EM MEMÓRIAS INESQUECÍVEIS.
          </h1>

          <Link href="/sobre" className={styles.btn}>
            Reservar agora
          </Link>
        </div>
      </section>
    </>
  );
}