// pages/admin/reservas.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/AdminLayout";
import BotaoNotificacoes from "../../components/BotaoNotificacoes";
import styles from "../../styles/admin.module.css";

const FILTROS = [
  { id: "ALL", label: "Todas" },
  { id: "PENDING", label: "Pendentes" },
  { id: "CONFIRMED", label: "Confirmadas" },
  { id: "CANCELLED", label: "Canceladas" },
];

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

function formatDateTimeBR(iso) {
  if (!iso) return "-";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
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

/* ===== Ícones dos botões ===== */
function Icone({ nome }) {
  const comum = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (nome === "confirmar") {
    return (
      <svg {...comum}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    );
  }

  if (nome === "cancelar") {
    return (
      <svg {...comum}>
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    );
  }

  if (nome === "detalhes") {
    return (
      <svg {...comum} strokeWidth={2}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.5v.01" />
      </svg>
    );
  }

  if (nome === "excluir") {
    return (
      <svg {...comum} strokeWidth={2}>
        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
      </svg>
    );
  }

  if (nome === "atualizar") {
    return (
      <svg {...comum} strokeWidth={2}>
        <path d="M20 11a8 8 0 1 0-2.3 6.3M20 5v6h-6" />
      </svg>
    );
  }

  // whatsapp
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.52 3.48A11.85 11.85 0 0012.06 0C5.53 0 .2 5.33.2 11.86c0 2.09.55 4.13 1.6 5.93L0 24l6.4-1.67a11.8 11.8 0 005.66 1.44h.01c6.53 0 11.86-5.33 11.86-11.86 0-3.17-1.23-6.15-3.41-8.33zM12.07 21.6h-.01a9.72 9.72 0 01-4.95-1.36l-.35-.2-3.8 1 1.01-3.7-.23-.38a9.7 9.7 0 01-1.49-5.15c0-5.36 4.36-9.72 9.73-9.72a9.66 9.66 0 016.88 2.85 9.67 9.67 0 012.85 6.87c0 5.36-4.36 9.72-9.72 9.72zm5.43-7.29c-.3-.15-1.76-.87-2.03-.97-.27-.1-.46-.15-.66.15-.2.3-.76.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.89-.8-1.5-1.8-1.67-2.1-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.66-1.6-.9-2.2-.24-.58-.48-.5-.66-.5h-.56c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.5 0 1.47 1.08 2.9 1.23 3.1.15.2 2.12 3.23 5.14 4.52.72.31 1.28.5 1.72.64.72.23 1.37.2 1.88.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z" />
    </svg>
  );
}

export default function AdminReservasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reservas, setReservas] = useState([]);
  const [error, setError] = useState("");
  const [agoraMs, setAgoraMs] = useState(() => Date.now());
  const [filtro, setFiltro] = useState("ALL");
  const [detalhe, setDetalhe] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

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

  // Chama a API que apaga uma reserva cancelada. Lança erro se falhar.
  async function pedirExclusao(id) {
    const res = await fetch(`/api/admin/reservas/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) throw new Error(j?.error || "Erro ao excluir");
  }

  // 🗑 EXCLUIR UMA RESERVA CANCELADA (apaga do banco, sem volta)
  async function excluirReserva(reserva) {
    const id = reserva?._id;
    if (!id) return;

    const nome = reserva?.customerId?.nome || "cliente";
    const ok = window.confirm(
      `Excluir a reserva cancelada de ${nome} (${formatDateBR(reserva?.dataReserva)})?\n\n` +
        "Ela será apagada de vez e não poderá ser recuperada."
    );
    if (!ok) return;

    try {
      setError("");
      await pedirExclusao(id);
      setReservas((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  // 🗑 EXCLUIR TODAS AS CANCELADAS
  async function excluirCanceladas() {
    const canceladas = reservas.filter((r) => r?.status === "CANCELLED");
    if (canceladas.length === 0) return;

    const ok = window.confirm(
      `Excluir as ${canceladas.length} reserva(s) cancelada(s)?\n\n` +
        "Elas serão apagadas de vez e não poderão ser recuperadas."
    );
    if (!ok) return;

    try {
      setError("");
      setExcluindo(true);

      for (const r of canceladas) {
        await pedirExclusao(r._id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setExcluindo(false);
      fetchReservas();
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

  // Fecha a janela de detalhes com a tecla Esc
  useEffect(() => {
    if (!detalhe) return undefined;

    function aoTeclar(event) {
      if (event.key === "Escape") setDetalhe(null);
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [detalhe]);

  const contagem = {
    ALL: reservas.length,
    PENDING: reservas.filter((r) => r?.status === "PENDING").length,
    CONFIRMED: reservas.filter((r) => r?.status === "CONFIRMED").length,
    CANCELLED: reservas.filter((r) => r?.status === "CANCELLED").length,
  };

  const visiveis =
    filtro === "ALL" ? reservas : reservas.filter((r) => r?.status === filtro);

  return (
    <AdminLayout
      title="Reservas"
      subtitle="Acompanhe os pedidos e registre o sinal."
      actions={
        <button
          type="button"
          className={styles.headerBtn}
          onClick={fetchReservas}
          disabled={loading}
          aria-label="Atualizar reservas"
        >
          <Icone nome="atualizar" />
          <span className={styles.headerBtnLabel}>
            {loading ? "Atualizando..." : "Atualizar"}
          </span>
        </button>
      }
    >
      <div className={styles.adminWrap}>
        <div className={styles.filters} role="group" aria-label="Filtrar por status">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`${styles.fbtn} ${filtro === f.id ? styles.fbtnActive : ""}`}
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
            >
              {f.label}
              <span className={styles.count}>{contagem[f.id]}</span>
            </button>
          ))}
        </div>

        <BotaoNotificacoes />

        {filtro === "CANCELLED" && contagem.CANCELLED > 0 && (
          <div className={styles.rightTools}>
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={excluirCanceladas}
              disabled={excluindo}
            >
              {excluindo ? "Excluindo..." : `Excluir todas as canceladas (${contagem.CANCELLED})`}
            </button>
          </div>
        )}

        {error && (
          <div className={styles.alertError} role="alert">
            {error}
          </div>
        )}

        {loading && reservas.length === 0 ? (
          <p className={styles.loading}>Carregando reservas...</p>
        ) : (
          <div className={styles.card}>
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
                {visiveis.length === 0 && (
                  <tr>
                    <td className={styles.empty} colSpan={6}>
                      {filtro === "ALL"
                        ? "Nenhuma reserva ainda. Quando um cliente escolher uma data no site, ela aparece aqui."
                        : "Nenhuma reserva com esse status."}
                    </td>
                  </tr>
                )}

                {visiveis.map((r) => {
                  const prazoCorrendo = temPrazoCorrendo(r);
                  const prazo = prazoCorrendo ? textoPrazo(r.expiraEm, agoraMs) : null;
                  const vencida = prazoCorrendo && Date.parse(r.expiraEm) <= agoraMs;

                  return (
                    <tr key={r._id} className={styles["row_" + r.status] || ""}>
                      <td className={styles.tdStrong}>{r?.customerId?.nome || "-"}</td>
                      <td data-label="WhatsApp">{r?.customerId?.whatsapp || "-"}</td>
                      <td data-label="Data">{formatDateBR(r?.dataReserva)}</td>

                      <td data-label="Status">
                        <div>
                          <span className={`${styles.badge} ${styles["b_" + r.status] || ""}`}>
                            {statusLabel(r?.status)}
                          </span>

                          {prazo && (
                            <small
                              className={`${styles.prazo} ${vencida ? styles.prazoVencido : ""}`}
                              title={
                                vencida
                                  ? "O sinal não foi registrado em 24h. A data já aparece livre no calendário."
                                  : "Tempo para registrar o sinal antes de a data ser liberada"
                              }
                            >
                              {vencida ? "⚠ " : "⏳ "}
                              {prazo}
                            </small>
                          )}

                          {r?.canceladaAutomaticamente && (
                            <small
                              className={styles.nota}
                              title="Cancelada porque o sinal não foi pago em 24h"
                            >
                              Prazo do sinal vencido
                            </small>
                          )}
                        </div>
                      </td>

                      {/* ENTRADA */}
                      <td data-label="Entrada">
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
                            <small className={styles.entryHint}>—</small>
                          ) : r?.status === "PENDING" ? (
                            <small
                              className={styles.entryHint}
                              title='Use "Sinal recebido" em Ações'
                            >
                              Aguardando sinal
                            </small>
                          ) : (
                            <button
                              type="button"
                              className={styles.btnEntry}
                              onClick={() => marcarEntradaPaga(r)}
                              title="Registrar o sinal de uma reserva já confirmada"
                            >
                              Marcar como pago
                            </button>
                          )}
                        </div>
                      </td>

                      {/* AÇÕES */}
                      <td>
                        <div className={styles.actions}>
                          {r?.status === "PENDING" && !r?.entradaPaga && (
                            <button
                              type="button"
                              className={styles.primaryBtn}
                              onClick={() => sinalRecebidoConfirmar(r)}
                              title="Marca a entrada como paga e confirma a reserva"
                            >
                              Sinal recebido
                            </button>
                          )}

                          {r?.status === "PENDING" && (
                            <button
                              type="button"
                              className={styles.btnSuccess}
                              onClick={() => confirmarReserva(r._id)}
                              title="Confirmar sem registrar o sinal"
                            >
                              <Icone nome="confirmar" />
                              <span className={styles.btnLabel}>Confirmar</span>
                            </button>
                          )}

                          {r?.status !== "CANCELLED" && (
                            <button
                              type="button"
                              className={styles.btnDanger}
                              onClick={() => cancelarReserva(r._id)}
                              title="Cancelar reserva"
                            >
                              <Icone nome="cancelar" />
                              <span className={styles.btnLabel}>Cancelar</span>
                            </button>
                          )}

                          {r?.status === "CANCELLED" && (
                            <button
                              type="button"
                              className={styles.btnDanger}
                              onClick={() => excluirReserva(r)}
                              title="Excluir esta reserva cancelada"
                            >
                              <Icone nome="excluir" />
                              <span className={styles.btnLabel}>Excluir</span>
                            </button>
                          )}

                          {r?.customerId?.whatsapp && (
                            <a
                              className={styles.btn}
                              href={`https://wa.me/${normalizeBRPhone(r.customerId.whatsapp)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir conversa no WhatsApp"
                            >
                              <Icone nome="whatsapp" />
                              <span className={styles.btnLabel}>WhatsApp</span>
                            </a>
                          )}

                          <button
                            type="button"
                            className={styles.btn}
                            onClick={() => setDetalhe(r)}
                            title="Ver detalhes da reserva"
                          >
                            <Icone nome="detalhes" />
                            <span className={styles.btnLabel}>Detalhes</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {detalhe && (
          <div className={styles.modalOverlay} onClick={() => setDetalhe(null)}>
            <div
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-label="Detalhes da reserva"
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.modalHead}>
                <div>
                  <strong>{detalhe?.customerId?.nome || "Reserva"}</strong>
                  <div className={styles.modalSub}>
                    Festa em {formatDateBR(detalhe?.dataReserva)}
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => setDetalhe(null)}
                  aria-label="Fechar detalhes"
                >
                  <Icone nome="cancelar" />
                </button>
              </div>

              <div className={styles.modalGrid}>
                <div className={styles.kv}>
                  <span>Status</span>
                  <strong>{statusLabel(detalhe?.status)}</strong>
                </div>

                <div className={styles.kv}>
                  <span>Horário</span>
                  <strong>
                    {detalhe?.horarioInicio || "09:30"} às {detalhe?.horarioFim || "22:00"}
                  </strong>
                </div>

                <div className={styles.kv}>
                  <span>WhatsApp</span>
                  <strong>{detalhe?.customerId?.whatsapp || "-"}</strong>
                </div>

                <div className={styles.kv}>
                  <span>E-mail</span>
                  <strong>{detalhe?.customerId?.email || "-"}</strong>
                </div>

                <div className={styles.kv}>
                  <span>Sinal</span>
                  <strong>
                    {moneyBR(detalhe?.valorEntrada)}{" "}
                    {detalhe?.entradaPaga
                      ? `(pago em ${formatDateTimeBR(detalhe?.entradaPagaEm)})`
                      : "(não pago)"}
                  </strong>
                </div>

                <div className={styles.kv}>
                  <span>Valor total</span>
                  <strong>{moneyBR(detalhe?.valorTotal)}</strong>
                </div>

                <div className={styles.kv}>
                  <span>Restante a receber</span>
                  <strong>
                    {moneyBR(
                      Number(detalhe?.valorTotal || 0) -
                        (detalhe?.entradaPaga ? Number(detalhe?.valorEntrada || 0) : 0)
                    )}
                  </strong>
                </div>

                <div className={styles.kv}>
                  <span>Pedido feito em</span>
                  <strong>{formatDateTimeBR(detalhe?.createdAt)}</strong>
                </div>

                <div className={`${styles.kv} ${styles.kvFull}`}>
                  <span>Observações do cliente</span>
                  <strong>{detalhe?.observacoes || "Nenhuma observação."}</strong>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => setDetalhe(null)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}