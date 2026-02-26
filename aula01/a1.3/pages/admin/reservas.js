import { useMemo, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import styles from "../../styles/admin.module.css";

const MOCK = [
  { id: 1, name: "Maria", phone: "1199999-0000", date: "2026-03-07", status: "PENDING" },
  { id: 2, name: "João", phone: "1198888-1111", date: "2026-03-14", status: "CONFIRMED" },
  { id: 3, name: "Ana", phone: "1197777-2222", date: "2026-03-21", status: "CANCELLED" },
];

function statusLabel(status) {
  if (status === "CONFIRMED") return "Confirmada";
  if (status === "CANCELLED") return "Cancelada";
  return "Pendente";
}

export default function ReservasAdminPage() {
  const [filter, setFilter] = useState("ALL");
  const [rows, setRows] = useState(MOCK);

  const filtered = useMemo(() => {
    if (filter === "ALL") return rows;
    return rows.filter((r) => r.status === filter);
  }, [filter, rows]);

  function confirmReserva(id) {
    if (!confirm("Confirmar esta reserva?")) return;
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "CONFIRMED" } : r))
    );
  }

  function cancelReserva(id) {
    if (!confirm("Cancelar esta reserva?")) return;
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "CANCELLED" } : r))
    );
  }

  return (
    <AdminLayout title="Reservas">
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <button
            className={`${styles.fbtn} ${filter === "ALL" ? styles.fbtnActive : ""}`}
            onClick={() => setFilter("ALL")}
          >
            Todas
          </button>
          <button
            className={`${styles.fbtn} ${filter === "PENDING" ? styles.fbtnActive : ""}`}
            onClick={() => setFilter("PENDING")}
          >
            Pendentes
          </button>
          <button
            className={`${styles.fbtn} ${filter === "CONFIRMED" ? styles.fbtnActive : ""}`}
            onClick={() => setFilter("CONFIRMED")}
          >
            Confirmadas
          </button>
          <button
            className={`${styles.fbtn} ${filter === "CANCELLED" ? styles.fbtnActive : ""}`}
            onClick={() => setFilter("CANCELLED")}
          >
            Canceladas
          </button>
        </div>

        <button className={styles.primaryBtn}>+ Nova reserva</button>
      </div>

      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Telefone</th>
              <th>Data</th>
              <th>Horário</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className={styles.tdStrong}>{r.name}</td>
                <td>{r.phone}</td>
                <td>{r.date}</td>
                <td>09:30 - 22:00</td>
                <td>
                  <span className={`${styles.badge} ${styles["b_" + r.status]}`}>
                    {statusLabel(r.status)}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <div className={styles.actions}>
                    <button
                      className={styles.btn}
                      onClick={() => confirmReserva(r.id)}
                      disabled={r.status !== "PENDING"}
                      title="Confirmar"
                    >
                      ✅
                    </button>
                    <button
                      className={styles.btn}
                      onClick={() => cancelReserva(r.id)}
                      disabled={r.status === "CANCELLED"}
                      title="Cancelar"
                    >
                      ❌
                    </button>
                    <button className={styles.btn} title="Detalhes">🔎</button>
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  Nenhuma reserva encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}