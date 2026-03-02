import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import styles from "../styles/Calendar.module.css";
import { ptBR } from "date-fns/locale";

function toISODate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISOToDate(iso) {
  if (!iso || typeof iso !== "string") return null;

  const parts = iso.split("-");
  if (parts.length !== 3) return null;

  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return null;

  return new Date(y, m - 1, d);
}

export default function CalendarioPage() {
  const [selected, setSelected] = useState();

  const [step, setStep] = useState(1);

  // form
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");

  // datas ocupadas
  const [busyDates, setBusyDates] = useState([]); // array de "YYYY-MM-DD"
  const [loadingDates, setLoadingDates] = useState(true);

  // mensagens
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadBusyDates() {
    try {
      setLoadingDates(true);
        const r = await fetch("/api/reservas");
        const j = await r.json();
        setBusyDates(Array.isArray(j?.dates) ? j.dates : []);
    } catch (e) {
      setBusyDates([]);
    } finally {
      setLoadingDates(false);
    }
  }

  useEffect(() => {
    loadBusyDates();
  }, []);

  // ✅ desabilita: não fim de semana OU já reservado
  const disabled = useMemo(() => {
  const busySet = new Set(busyDates);

  return (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const day = d.getDay();
    const isWeekend = day === 0 || day === 6;

    const iso = toISODate(d);

    return (
      d < today ||        // ❌ bloqueia datas passadas
      !isWeekend ||       // ❌ bloqueia dias que não são sábado/domingo
      busySet.has(iso)    // ❌ bloqueia datas já reservadas
    );
  };
}, [busyDates]);

  const label = selected
    ? selected.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Selecione uma data (somente sábados e domingos).";

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");

    if (!selected) {
      setMsg("Selecione uma data primeiro.");
      return;
    }

    console.log("DATA SELECIONADA:", selected);
    console.log("DATA ENVIADA:", toISODate(selected));


    const data_evento = toISODate(selected);

    try {
      setSubmitting(true);

      const whatsappLimpo = String(whatsapp || "").replace(/\D/g, ""); // só números

    const r = await fetch("/api/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      nome,
      whatsapp: whatsappLimpo,          // ✅ envia no formato 11999999999
      email,
      dataReserva: toISODate(selected), // ✅ YYYY-MM-DD
      horarioInicio: "09:30",
      horarioFim: "22:00",
      valorEntrada: 0,
      valorTotal: 0,
      observacoes: "",
    }),
  });

      const j = await r.json();

      if (!r.ok) {
        setMsg(j?.error || "Erro ao reservar.");
        return;
      }

      setMsg("✅ Reserva criada! Entraremos em contato para confirmação.");

      // atualiza datas ocupadas e reseta
      await loadBusyDates();
      setSelected(undefined);
      setStep(1);
      setNome("");
      setWhatsapp("");
      setEmail("");
    } catch (err) {
      setMsg("Erro ao conectar com o servidor.");
    } finally {
      setSubmitting(false);
    }
  }
 

const busyDateObjects = useMemo(() => {
  return (busyDates || [])
    .map(parseISOToDate)
    .filter(Boolean);
}, [busyDates]);

const availableDateObjects = useMemo(() => {
  const busySet = new Set((busyDates || []).filter(Boolean));

  const dates = [];
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth() + 3, 0);

  for (let d = new Date(today); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    const iso = toISODate(d);

    if ((day === 0 || day === 6) && !busySet.has(iso)) {
      dates.push(new Date(d));
    }
  }

  return dates;
}, [busyDates]);

  return (
    <main className={styles.page}>
      <div className={styles.top}>
        <h1 className={styles.title}>Calendário de Reservas</h1>
        <p className={styles.subtitle}>
          Atendimento: finais de semana • Horário do evento: 09:30 às 22:00
        </p>

        <div className={styles.backRow}>
          <Link href="/" className={styles.backLink}>
            ← Voltar
          </Link>
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Escolha a data</h2>

          <div className={styles.calendarCenter}>
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={setSelected}
              disabled={disabled}
              fromMonth={new Date()}
              weekStartsOn={1}
              showOutsideDays
              locale={ptBR}
              modifiers={{
                busy: busyDateObjects,
                available: availableDateObjects
              }}
              modifiersClassNames={{
                busy: styles.busyDay,
                available: styles.availableDay
              }}
            />
          </div>

          <p className={styles.hint}>
            {loadingDates ? "Carregando datas ocupadas..." : label}
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Confirmar reserva</h2>

          <div className={styles.summary}>
            <div>
              <span>Data:</span>{" "}
              <strong>{selected ? selected.toLocaleDateString("pt-BR") : "—"}</strong>
            </div>
            <div>
              <span>Horário:</span> <strong>09:30 - 22:00</strong>
            </div>
          </div>

          {step === 1 && (
            <button
              className={styles.cta}
              disabled={!selected}
              onClick={() => {
                if (!selected) return;
                setStep(2);
                setMsg("");
              }}
            >
              {selected ? "Continuar" : "Selecione uma data"}
            </button>
          )}

          {step === 2 && (
            <section className={styles.formWrapper}>
              <div className={styles.formCard}>
                <h2 className={styles.formTitle}>Finalize sua reserva</h2>
                <p className={styles.formSubtitle}>
                  Preencha seus dados para garantir a data selecionada.
                </p>

                <form className={styles.form} onSubmit={onSubmit}>
                  <div className={styles.inputGroup}>
                    <label>Nome completo</label>
                    <input
                      type="text"
                      placeholder="Digite seu nome"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>WhatsApp</label>
                    <input
                      type="tel"
                      placeholder="(11) 9 9999-9999"
                      required
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>E-mail</label>
                    <input
                      type="email"
                      placeholder="seuemail@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <button type="submit" className={styles.submitBtn} disabled={submitting}>
                    {submitting ? "Enviando..." : "Confirmar Reserva"}
                  </button>
                </form>

                {msg && <p className={styles.msg}>{msg}</p>}

                <button
                  type="button"
                  className={styles.backLink}
                  onClick={() => setStep(1)}
                  style={{ marginTop: 12, display: "inline-block" }}
                >
                  ← Voltar
                </button>
              </div>
            </section>
          )}

          <p className={styles.hint}>
            (Próximo passo pode ser: escolher pacote, preencher dados e pagar sinal/PIX.)
          </p>
        </section>
      </div>
    </main>
  );
}