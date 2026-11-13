// pages/admin/reservas.js
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

/* ===== Prazo do sinal (24h) ===== */

// Só reservas pendentes sem sinal têm prazo correndo
function temPrazoCorrendo(r) {
  return r?.status === "PENDING" && !r?.entradaPaga && !!r?.expiraEm;
}

// "Expira em 5h 20min" | "Expira em 12min" | "Prazo vencido" | null
function textoPrazo(expiraEm, agoraMs) {
  const fim = Date.parse(expiraEm);
  if (Number.isNaN(fim)) return null;

  const ms = fim - agoraMs;
  if (ms <= 0) return "Prazo vencido";

  const horas = Math.floor(ms / 3600000);
  const minutos = Math.floor((ms % 3600000) / 60000);

  if (horas > 0) return `Expira em ${horas}h ${minutos}min`;
  return `Expira em ${minutos}min`;
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

  // api.whatsapp.com direto (sem o redirecionamento do wa.me),
  // que em alguns aparelhos quebra emojis da mensagem (aparece "�").
  const url = new URL("https://api.whatsapp.com/send");
  url.searchParams.set("phone", phone);
  url.searchParams.set("text", message.trim()); // Firefox-friendly

  window.open(url.toString(), "_blank", "noopener,noreferrer");
  return true;
}

export default function AdminReservasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reservas, setReservas] = useState([]);
  const [error, setError] = useState("");
  const [agoraMs, setAgoraMs] = useState(() => Date.now());

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

  // ✅ SINAL RECEBIDO → CONFIRMAR (marca a entrada e confirma de uma vez)
  async function sinalRecebidoConfirmar(reserva) {
    const id = reserva?._id;
    if (!id) return;

    const ok = window.confirm(
      `Sinal de ${moneyBR(reserva?.valorEntrada)} recebido?\n\n` +
        "Isso marca a entrada como paga e confirma a reserva."
    );
    if (!ok) return;

    try {
      setError("");

      const res = await fetch(`/api/admin/reservas/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CONFIRM_ENTRY" }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j?.error || "Erro ao confirmar com sinal");

      const nome = reserva?.customerId?.nome || "Cliente";
      const phone = reserva?.customerId?.whatsapp;

      const msg = `
✨ *Reserva Confirmada*

Olá ${nome}, tudo bem?

Recebemos o sinal e sua reserva está confirmada.

Data do Evento: ${formatDateBR(reserva?.dataReserva)}
Horário: ${reserva?.horarioInicio || "09:30"} às ${reserva?.horarioFim || "22:00"}
Sinal recebido: ${moneyBR(reserva?.valorEntrada)}
Valor Total: ${moneyBR(reserva?.valorTotal)}

Seu evento já está oficialmente garantido conosco.

Caso precise de qualquer informação adicional, estamos à disposição.
`;

      if (phone) {
        const avisar = window.confirm(
          "Reserva confirmada com sinal ✅\nDeseja avisar o cliente no WhatsApp?"
        );
        if (avisar) openWhatsApp(phone, msg);
      }

      fetchReservas();
    } catch (err) {
      setError(err.message);
    }
  }

  // ✅ CONFIRMAR RESERVA (mensagem de confirmação)
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

Olá ${nome}, tudo bem?

Sua reserva foi confirmada com sucesso.

Data do Evento: ${formatDateBR(rLocal?.dataReserva)}
Horário: ${rLocal?.horarioInicio || "09:30"} às ${rLocal?.horarioFim || "22:00"}
Valor da Entrada: ${moneyBR(rLocal?.valorEntrada)}
Valor Total: ${moneyBR(rLocal?.valorTotal)}

Estamos preparando tudo para proporcionar uma experiência memorável.

Caso precise de qualquer informação adicional, estamos à disposição.
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
    if (!window.confirm("Registrar o pagamento da entrada?")) return;

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
                vencida: false,
              }
            : r
        )
      );

      const nome = reserva?.customerId?.nome || "Cliente";
      const whatsapp = reserva?.customerId?.whatsapp;

      const msg = `
*Confirmação de Pagamento Recebida*

Olá ${nome}, tudo bem?

Confirmamos o recebimento da entrada referente à sua reserva.

Data do Evento: ${formatDateBR(reserva?.dataReserva)}
Horário: ${reserva?.horarioInicio || "09:30"} às ${reserva?.horarioFim || "22:00"}
Valor da Entrada: ${moneyBR(reserva?.valorEntrada)}

Seu evento já está oficialmente garantido conosco.

Estamos preparando tudo para proporcionar uma experiência memorável.

Caso precise de qualquer informação adicional, estamos à disposição.
`;

      if (whatsapp) {
        const ok = openWhatsApp(whatsapp, msg);
        if (!ok) alert("Entrada marcada ✅, mas o WhatsApp do cliente está inválido.");
      } else {
        alert("Entrada marcada ✅, mas não encontrei o WhatsApp do cliente.");
      }
    } catch (err) {
      setError(err.message);
    }
  }

  // ↩ DESFAZER ENTRADA PAGA (registro feito por engano)
  async function desmarcarEntradaPaga(reserva) {
    if (!window.confirm("Desfazer o registro de pagamento da entrada?")) return;

    try {
      setError("");
      const id = reserva?._id;

      const resp = await fetch(`/api/admin/reservas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "UNMARK_ENTRY_PAID" }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) {
        throw new Error(data?.error || `Falha ao desfazer (HTTP ${resp.status})`);
      }

      // Recarrega: se a reserva estiver pendente, o prazo volta a valer
      fetchReservas();
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    fetchReservas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza o contador de prazo a cada minuto
  useEffect(() => {
    const timer = setInterval(() => setAgoraMs(Date.now()), 60000);
    return () => clearInterval(timer);
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
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {reservas.map((r) => {
                const prazoCorrendo = temPrazoCorrendo(r);
                const prazo = prazoCorrendo ? textoPrazo(r.expiraEm, agoraMs) : null;
                const vencida = prazoCorrendo && Date.parse(r.expiraEm) <= agoraMs;

                return (
                  <tr key={r._id}>
                    <td>{r?.customerId?.nome || "-"}</td>
                    <td>{r?.customerId?.whatsapp || "-"}</td>
                    <td>{formatDateBR(r?.dataReserva)}</td>

                    <td>
                      <span className={`${styles.badge} ${styles["b_" + r.status]}`}>
                        {statusLabel(r?.status)}
                      </span>
                      {prazo && (
                        <>
                          <br />
                          <small
                            title={
                              vencida
                                ? "O sinal não foi registrado em 24h. A data já aparece livre no calendário."
                                : "Tempo para registrar o sinal antes de a data ser liberada"
                            }
                          >
                            {vencida ? "⚠ " : "⏳ "}
                            {prazo}
                          </small>
                        </>
                      )}
                      {r?.canceladaAutomaticamente && (
                        <>
                          <br />
                          <small title="Cancelada porque o sinal não foi pago em 24h">
                            Prazo do sinal vencido
                          </small>
                        </>
                      )}
                    </td>

                    {/* ENTRADA */}
                    <td>
                      <div className={styles.entryBox}>
                        <span className={styles.entryValue}>{moneyBR(r?.valorEntrada)}</span>

                        {r?.entradaPaga ? (
                          <>
                            <small className={styles.entryPaid}>
                              Pago em{" "}
                              {r?.entradaPagaEm
                                ? new Date(r.entradaPagaEm).toLocaleDateString("pt-BR")
                                : "-"}
                            </small>
                            <button
                              type="button"
                              className={styles.btnUndo}
                              onClick={() => desmarcarEntradaPaga(r)}
                              title="Desfazer registro de pagamento"
                            >
                              Desfazer
                            </button>
                          </>
                        ) : r?.status === "CANCELLED" ? (
                          <small>—</small>
                        ) : r?.status === "PENDING" ? (
                          <small title='Use "Sinal recebido → Confirmar" em Ações'>
                            Aguardando sinal
                          </small>
                        ) : (
                          <button
                            type="button"
                            className={styles.btnEntry}
                            onClick={() => marcarEntradaPaga(r)}
                            title="Registrar o sinal de uma reserva já confirmada"
                          >
                            Marcar
                          </button>
                        )}
                      </div>
                    </td>

                    {/* AÇÕES */}
                    <td className={styles.actions}>
                      {r?.status === "PENDING" && !r?.entradaPaga && (
                        <button
                          type="button"
                          className={styles.btnSuccess}
                          onClick={() => sinalRecebidoConfirmar(r)}
                          title="Marca a entrada como paga e confirma a reserva"
                        >
                          Sinal recebido → Confirmar
                        </button>
                      )}

                      <button
                        type="button"
                        className={styles.btnSuccess}
                        onClick={() => confirmarReserva(r._id)}
                        disabled={r?.status === "CONFIRMED" || r?.status === "CANCELLED"}
                        title={
                          r?.status === "CANCELLED"
                            ? "Reserva cancelada não pode ser confirmada"
                            : "Confirmar sem registrar o sinal"
                        }
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}