import { useMemo, useState } from "react";
import Link from "next/link";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import styles from "../styles/Calendar.module.css";

import { ptBR } from "date-fns/locale"; 

export default function CalendarioPage() {
  const [selected, setSelected] = useState();

  // ✅ Só sábado (6) e domingo (0)
  const disabled = useMemo(() => {
    return (date) => {
      const day = date.getDay();
      return !(day === 0 || day === 6);
    };
  }, []);

  const label = selected
    ? selected.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    : "Selecione uma data (somente sábados e domingos).";

  return (
    <main className={styles.page}>
      <div className={styles.top}>
        <h1 className={styles.title}>Calendário de Reservas</h1>
        <p className={styles.subtitle}>Atendimento: finais de semana • Horário do evento: 09:30 às 22:00</p>

        <div className={styles.backRow}>
          <Link href="/" className={styles.backLink}>← Voltar</Link>
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Escolha a data</h2>

          <DayPicker
            mode="single"
            selected={selected}
            onSelect={setSelected}
            disabled={disabled}
            fromMonth={new Date()}
            weekStartsOn={1}   // começa na segunda (padrão Brasil)
            showOutsideDays
            locale={ptBR}      // 🔥 aqui está o segredo
          />

          <p className={styles.selected}>{label}</p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Confirmar reserva</h2>

          <div className={styles.summary}>
            <div><span>Data:</span> <strong>{selected ? selected.toLocaleDateString("pt-BR") : "—"}</strong></div>
            <div><span>Horário:</span> <strong>09:30 - 22:00</strong></div>
          </div>

          <button
            className={styles.cta}
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              alert(`Reserva iniciada para ${selected.toLocaleDateString("pt-BR")} (09:30 - 22:00)`);
            }}
          >
            {selected ? "Continuar" : "Selecione uma data"}
          </button>

          <p className={styles.hint}>
            (Próximo passo pode ser: escolher pacote, preencher dados e pagar sinal/PIX.)
          </p>
        </section>
      </div>
    </main>
  );
}