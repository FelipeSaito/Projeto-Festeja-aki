// pages/admin/reservas/index.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/AdminLayout";
import styles from "../../styles/admin.module.css";

function statusLabel(status) {
  if (status === "CONFIRMED") return "Confirmada";
  if (status === "PENDING") return "Pendente";
  if (status === "CANCELLED") return "Cancelada";
  return status || "-";
}

function formatDateBR(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return "-";
  const [y, m, d] = String(yyyy_mm_dd).split("-");
  if (!y || !m || !d) return String(yyyy_mm_dd);
  return `${d}/${m}/${y}`;
}

function moneyBR(value) {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ===== WhatsApp helpers ===== */
function onlyDigits(v = "") {
  return String(v).replace(/\D/g, "");
}

function normalizeBRPhone(raw = "") {
  const d = onlyDigits(raw);
  if (!d) return "";
  // se vier só DDD+cel (11 dígitos), adiciona DDI 55
  if (d.length === 11) return `55${d}`;
  return d; // se já vier com 55, mantém
}

function openWhatsApp(phoneRaw, message) {
  const phone = normalizeBRPhone(phoneRaw);
  if (!phone) return false;

  const url = new URL(`https://wa.me/${phone}`);
  url.searchParams.set("text", message); // Firefox-friendly

  window.open(url.toString(), "_blank", "noopener,noreferrer");
  return true;
}

export default function AdminReservasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reservas, setReservas] = useState([]);
  const [error, setError] = useState("");

  async function fetchReservas() {
    try {
      setError("");
      setLoading(true);

      const res = await fetch("/api/admin/reservas?full=1", {
        method: "GET",
        credentials: "include",
      });

      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j?.error || "Erro ao carregar reservas");

      setReservas(Array.isArray(j.reservas) ? j.reservas : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ✅ CONFIRMAR RESERVA (mensagem de confirmacao)
  async function confirmarReserva(id) {
    if (!window.confirm("Confirmar esta reserva?")) return;

    try {
      setError("");

      const res = await fetch(`/api/admin/reservas/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CONFIRM" }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j?.error || "Erro ao confirmar");

      const rLocal = reservas.find((x) => x._id === id);
      if (!rLocal) {
        fetchReservas();
        return;
      }

      const nome = rLocal?.customerId?.nome || "Cliente";
      const phone = rLocal?.customerId?.whatsapp;

      const msg = `
✨ *Reserva Confirmada*

Ola ${nome}, tudo bem?

Sua reserva foi confirmada com sucesso.

Data do Evento: ${formatDateBR(rLocal?.dataReserva)}
Horario: ${rLocal?.horarioInicio || "09:30"} as ${rLocal?.horarioFim || "22:00"}
Valor da Entrada: ${moneyBR(rLocal?.valorEntrada)}
Valor Total: ${moneyBR(rLocal?.valorTotal)}

Estamos preparando tudo para proporcionar uma experiencia memoravel.

Caso precise de qualquer informacao adicional, estamos a disposicao.
`;

      if (phone) {
        const avisar = window.confirm(
          "Reserva confirmada com sucesso ✅\nDeseja avisar o cliente no WhatsApp?"
        );
        if (avisar) openWhatsApp(phone, msg);
      }

      fetchReservas();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cancelarReserva(id) {
    if (!window.confirm("Cancelar esta reserva?")) return;

    try {
      setError("");

      const res = await fetch(`/api/admin/reservas/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL" }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j?.error || "Erro ao cancelar");

      fetchReservas();
    } catch (err) {
      setError(err.message);
    }
  }

  // ✅ MARCAR ENTRADA PAGA (mensagem de pagamento)
  async function marcarEntradaPaga(reserva) {
    try {
      setError("");
      const id = reserva?._id;

      const resp = await fetch(`/api/admin/reservas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "MARK_ENTRY_PAID" }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) {
        throw new Error(data?.error || `Falha ao marcar (HTTP ${resp.status})`);
      }

      // Atualiza UI sem refresh
      setReservas((prev) =>
        prev.map((r) =>
          r._id === id
            ? {
                ...r,
                entradaPaga: true,
                entradaPagaEm: data?.reserva?.entradaPagaEm || new Date().toISOString(),
              }
            : r
        )
      );

      const nome = reserva?.customerId?.nome || "Cliente";
      const whatsapp = reserva?.customerId?.whatsapp;

      const msg = `
*Confirmacao de Pagamento Recebida*

Ola ${nome}, tudo bem?

Confirmamos o recebimento da entrada referente a sua reserva.

Data do Evento: ${formatDateBR(reserva?.dataReserva)}
Horario: ${reserva?.horarioInicio || "09:30"} as ${reserva?.horarioFim || "22:00"}
Valor da Entrada: ${moneyBR(reserva?.valorEntrada)}

Seu evento ja esta oficialmente garantido conosco.

Estamos preparando tudo para proporcionar uma experiencia memoravel.

Caso precise de qualquer informacao adicional, estamos a disposicao.
`;

      if (whatsapp) {
        const ok = openWhatsApp(whatsapp, msg);
        if (!ok) alert("Entrada marcada ✅, mas o WhatsApp do cliente esta invalido.");
      } else {
        alert("Entrada marcada ✅, mas nao encontrei o WhatsApp do cliente.");
      }
    } catch (err) {
      console.error("marcarEntradaPaga:", err);
      alert(err.message);
    }
  }

  useEffect(() => {
    fetchReservas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminLayout>
      <div className={styles.adminWrap}>
        <h1>Reservas</h1>

        {error && <div className={styles.alertError}>{error}</div>}

        {loading ? (
          <p>Carregando...</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>WhatsApp</th>
                <th>Data</th>
                <th>Status</th>
                <th>Entrada</th>
                <th>Acoes</th>
              </tr>
            </thead>

            <tbody>
              {reservas.map((r) => (
                <tr key={r._id}>
                  <td>{r?.customerId?.nome || "-"}</td>
                  <td>{r?.customerId?.whatsapp || "-"}</td>
                  <td>{formatDateBR(r?.dataReserva)}</td>

                  <td>
                    <span className={`${styles.badge} ${styles["b_" + r.status]}`}>
                      {statusLabel(r?.status)}
                    </span>
                  </td>

                  {/* ENTRADA */}
                  <td>
                    <div className={styles.entryBox}>
                      <span className={styles.entryValue}>{moneyBR(r?.valorEntrada)}</span>

                      {r?.entradaPaga ? (
                        <small className={styles.entryPaid}>
                          Pago em{" "}
                          {r?.entradaPagaEm
                            ? new Date(r.entradaPagaEm).toLocaleDateString("pt-BR")
                            : "-"}
                        </small>
                      ) : (
                        <button
                          type="button"
                          className={styles.btnEntry}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            marcarEntradaPaga(r);
                          }}
                          title="Marcar entrada como paga"
                        >
                          Marcar
                        </button>
                      )}
                    </div>
                  </td>

                  {/* ACOES */}
                  <td className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btnSuccess}
                      onClick={() => confirmarReserva(r._id)}
                      disabled={r?.status === "CONFIRMED"}
                      title="Confirmar"
                    >
                      ✔
                    </button>

                    <button
                      type="button"
                      className={styles.btnDanger}
                      onClick={() => cancelarReserva(r._id)}
                      disabled={r?.status === "CANCELLED"}
                      title="Cancelar"
                    >
                      ✖
                    </button>

                    {r?.customerId?.whatsapp && (
                      <a
                        className={styles.btn}
                        href={`https://wa.me/${normalizeBRPhone(r.customerId.whatsapp)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir WhatsApp"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M20.52 3.48A11.85 11.85 0 0012.06 0C5.53 0 .2 5.33.2 11.86c0 2.09.55 4.13 1.6 5.93L0 24l6.4-1.67a11.8 11.8 0 005.66 1.44h.01c6.53 0 11.86-5.33 11.86-11.86 0-3.17-1.23-6.15-3.41-8.33zM12.07 21.6h-.01a9.72 9.72 0 01-4.95-1.36l-.35-.2-3.8 1 1.01-3.7-.23-.38a9.7 9.7 0 01-1.49-5.15c0-5.36 4.36-9.72 9.73-9.72a9.66 9.66 0 016.88 2.85 9.67 9.67 0 012.85 6.87c0 5.36-4.36 9.72-9.72 9.72zm5.43-7.29c-.3-.15-1.76-.87-2.03-.97-.27-.1-.46-.15-.66.15-.2.3-.76.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.89-.8-1.5-1.8-1.67-2.1-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.66-1.6-.9-2.2-.24-.58-.48-.5-.66-.5h-.56c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.5 0 1.47 1.08 2.9 1.23 3.1.15.2 2.12 3.23 5.14 4.52.72.31 1.28.5 1.72.64.72.23 1.37.2 1.88.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z" />
                        </svg>
                      </a>
                    )}

                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => alert(JSON.stringify(r, null, 2))}
                      title="Ver detalhes"
                    >
                      ℹ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}