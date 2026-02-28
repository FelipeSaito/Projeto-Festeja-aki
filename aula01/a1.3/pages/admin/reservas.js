import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import styles from "../../styles/admin.module.css";

function statusLabel(status) {
  if (status === "CONFIRMED") return "Confirmada";
  if (status === "CANCELLED") return "Cancelada";
  return "Pendente";
}

// data_evento vem como "YYYY-MM-DD" (string) no seu backend
function formatBRDate(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return "-";
  const [y, m, d] = String(yyyy_mm_dd).split("-");
  if (!y || !m || !d) return String(yyyy_mm_dd);
  return `${d}/${m}/${y}`;
}

function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

function openWhats(reserva) {
  const phone = onlyDigits(reserva.customerId?.whatsapp);
  if (!phone) {
    alert("Telefone não encontrado.");
    return;
  }

  const msg =
    `Olá, ${reserva.customerId?.nome || "tudo bem"}! 😊\n` +
    `Sobre sua reserva do salão:\n` +
    `📅 Data: ${reserva.dataReserva}\n` +
    `⏰ Horário: ${reserva.horarioInicio || "09:30"} - ${reserva.horarioFim || "22:00"}\n` +
    `📌 Status: ${statusLabel(reserva.status)}\n\n` +
    `Se precisar de algo, me avise!`;

  const full = phone.startsWith("55") ? phone : `55${phone}`;
  const url = `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function ReservasAdminPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [q, setQ] = useState("");
  const [dateFilter, setDateFilter] = useState(""); // yyyy-mm-dd
  const [sort, setSort] = useState("DATE_ASC"); // DATE_ASC | DATE_DESC | CREATED_DESC

  // modal
  const [openId, setOpenId] = useState(null);
  const selected = useMemo(
    () => rows.find((r) => String(r._id) === String(openId)) || null,
    [openId, rows]
  );

  useEffect(() => {
    fetchReservas();
  }, []);

  async function fetchReservas() {
  setLoading(true);
  try {
    const res = await fetch("/api/reservas?full=1", {
      headers: {
        "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY,
      },
    });

    const j = await res.json();

    if (!res.ok) {
      alert(j?.error || "Erro ao carregar reservas.");
      setRows([]);
      return;
    }

    setRows(Array.isArray(j?.reservas) ? j.reservas : []);
  } catch (e) {
    alert("Erro ao carregar reservas.");
    setRows([]);
  } finally {
    setLoading(false);
  }
}

  const filtered = useMemo(() => {
    let data = [...rows];

    if (statusFilter !== "ALL") {
      data = data.filter((r) => r.status === statusFilter);
    }

    if (dateFilter) {
      data = data.filter((r) => r.dataReserva === dateFilter);
    }    

  const query = q.trim().toLowerCase();
    if (query) {
    data = data.filter((r) => {
      const nome = (r.customerId?.nome || "").toLowerCase();
      const whats = (r.customerId?.whatsapp || "").toLowerCase();
      const dataR = (r.dataReserva || "");
      return nome.includes(query) || whats.includes(query) || dataR.includes(query);
  });
}

    // ordenação (por data_evento e createdAt se existir)
    if (sort === "DATE_ASC") data.sort((a, b) => (a.dataReserva > b.dataReserva ? 1 : -1));
    if (sort === "DATE_DESC") data.sort((a, b) => (a.dataReserva < b.dataReserva ? 1 : -1));
    if (sort === "CREATED_DESC") data.sort((a, b) => ((a.createdAt || "") < (b.createdAt || "") ? 1 : -1));

    return data;
  }, [rows, statusFilter, q, dateFilter, sort]);

  const counts = useMemo(() => {
    const c = { ALL: rows.length, PENDING: 0, CONFIRMED: 0, CANCELLED: 0 };
    rows.forEach((r) => (c[r.status] = (c[r.status] || 0) + 1));
    return c;
  }, [rows]);

  async function confirmReserva(id) {
    if (!window.confirm("Confirmar esta reserva?")) return;

    const res = await fetch(`/api/reservas/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY,
  },
  body: JSON.stringify({ action: "confirm" }),
});

    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || "Erro ao confirmar.");
      return;
    }

    fetchReservas();
  }

  async function cancelReserva(id) {
  if (!window.confirm("Cancelar esta reserva?")) return;

  try {
    const res = await fetch(`/api/reservas/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY,
      },
      body: JSON.stringify({ action: "cancel" }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data?.error || "Erro ao cancelar reserva.");
      return;
    }

    alert("Reserva cancelada com sucesso!");
    fetchReservas(); // recarrega lista
  } catch (err) {
    alert("Erro ao conectar com o servidor.");
  }
}

  async function markEntradaPaga(id) {
    const valor = prompt("Valor da entrada (R$):", "200");
      if (valor === null) return;

    const valorEntrada = Number(valor.replace(",", ".").trim());

      if (!valorEntrada || valorEntrada <= 0) {
      alert("Digite um valor válido maior que zero.");
      return;
    }

    const res = await fetch(`/api/reservas/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY,
  },
  
  body: JSON.stringify({ action: "ENTRADA_PAGA", valorEntrada }),
});

    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || "Erro ao marcar entrada paga.");
      return;
    }

    fetchReservas();
  }

  async function deleteReserva(id) {
    const cliente = rows.find((r) => String(r._id) === String(id));
    const nome = cliente?.nome ? ` ${cliente.nome}` : "";

    const ok = window.confirm(
      `Tem certeza que deseja excluir${nome}? Essa ação não pode ser desfeita.`
    );
    if (!ok) return;

    const res = await fetch(`/api/reservas/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || "Erro ao excluir.");
      return;
    }

    fetchReservas();
  }

  function clearFilters() {
    setStatusFilter("ALL");
    setQ("");
    setDateFilter("");
    setSort("DATE_ASC");
  }

  return (
    <AdminLayout title="Reservas">
      {/* Top filters */}
      <div className={styles.topbar}>
        <div className={styles.filters}>
          <button
            type="button"
            className={`${styles.fbtn} ${statusFilter === "ALL" ? styles.fbtnActive : ""}`}
            onClick={() => setStatusFilter("ALL")}
          >
            Todas <span className={styles.count}>{counts.ALL}</span>
          </button>

          <button
            type="button"
            className={`${styles.fbtn} ${statusFilter === "PENDING" ? styles.fbtnActive : ""}`}
            onClick={() => setStatusFilter("PENDING")}
          >
            Pendentes <span className={styles.count}>{counts.PENDING}</span>
          </button>

          <button
            type="button"
            className={`${styles.fbtn} ${statusFilter === "CONFIRMED" ? styles.fbtnActive : ""}`}
            onClick={() => setStatusFilter("CONFIRMED")}
          >
            Confirmadas <span className={styles.count}>{counts.CONFIRMED}</span>
          </button>

          <button
            type="button"
            className={`${styles.fbtn} ${statusFilter === "CANCELLED" ? styles.fbtnActive : ""}`}
            onClick={() => setStatusFilter("CANCELLED")}
          >
            Canceladas <span className={styles.count}>{counts.CANCELLED}</span>
          </button>
        </div>

        <div className={styles.rightTools}>
          <input
            className={styles.search}
            placeholder="Buscar nome/whats/data..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <input
            className={styles.dateInput}
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            title="Filtrar por data"
          />

          <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="DATE_ASC">Data (crescente)</option>
            <option value="DATE_DESC">Data (decrescente)</option>
            <option value="CREATED_DESC">Criadas (mais recentes)</option>
          </select>

          <button type="button" className={styles.ghostBtn} onClick={clearFilters}>
            Limpar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={styles.card}>
        {loading ? (
          <div style={{ padding: 16 }}>Carregando reservas...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>WhatsApp</th>
                <th>Data</th>
                <th>Horário</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Ações</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => (
                <tr key={r._id}>
                  <td className={styles.tdStrong}>{r.customerId?.nome || "-"}</td>
                  <td>{r.customerId?.whatsapp || "-"}</td>
                  <td>{formatBRDate(r.dataReserva)}</td>
                  <td>{(r.horarioInicio || "09:30") + " - " + (r.horarioFim || "22:00")}</td>

                  <td>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span className={`${styles.badge} ${styles["b_" + r.status]}`}>
                        {statusLabel(r.status)}
                      </span>

                      {Number(r.valorEntrada) > 0 && (
                        <span className={styles.badgeMoney}>
                          💰 Entrada paga
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={{ textAlign: "right" }}>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => setOpenId(r._id)}
                        title="Ver detalhes"
                      >
                        🔎
                      </button>

                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => confirmReserva(r._id)}
                        disabled={r.status !== "PENDING"}
                        title="Confirmar"
                      >
                        ✅
                      </button>

                      <button
                        type="button"
                        className={styles.btnDanger}
                        onClick={() => cancelReserva(r._id)}
                        disabled={r.status === "CANCELLED"}
                        title="Cancelar"
                      >
                        ❌
                      </button>

                      <button
                        type="button"
                        className={styles.btnMoney}
                        onClick={() => markEntradaPaga(r._id)}
                        disabled={r.status === "CANCELLED"}
                        title="Marcar entrada paga"
                      >
                        💰
                      </button>

                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => openWhats(r)}
                        title="Chamar no WhatsApp"
                      >
                        📲
                      </button>

                      <button
                        type="button"
                        className={styles.btnDanger}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteReserva(r._id);
                        }}
                        title="Excluir"
                      >
                        🗑️
                      </button>
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
        )}
      </div>

      {/* Modal de detalhes */}
      {selected && (
        <div className={styles.modalOverlay} onClick={() => setOpenId(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div>
                <strong>Detalhes da Reserva</strong>
                <div className={styles.modalSub}>ID #{String(selected._id)}</div>
              </div>
              <button type="button" className={styles.modalClose} onClick={() => setOpenId(null)}>
                ✕
              </button>
            </div>

            <div className={styles.modalGrid}>
              <div className={styles.kv}>
                <span>Cliente</span>
                <strong>{selected.customerId?.nome || "-"}</strong>
              </div>

              <div className={styles.kv}>
                <span>WhatsApp</span>
                <strong>{selected.customerId?.whatsapp || "-"}</strong>
              </div>

              <div className={styles.kv}>
                <span>Data</span>
                <strong>{formatBRDate(selected.dataReserva)}</strong>
              </div>

              <div className={styles.kv}>
                <span>Horário</span>
                <strong>
                  {(selected.horarioInicio || "09:30") + " - " + (selected.horarioFim || "22:00")}
                </strong>
              </div>

              <div className={styles.kv}>
                <span>Status</span>
                <strong>{statusLabel(selected.status)}</strong>
              </div>

              <div className={styles.kv}>
                <span>Entrada</span>
                <strong>
                  {Number(selected.valorEntrada) > 0
                    ? `Paga ✅ (R$ ${selected.valorEntrada})`
                    : "Não paga ❌"}
                </strong>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => confirmReserva(selected._id)}
                disabled={selected.status !== "PENDING"}
              >
                Confirmar
              </button>

              <button
                type="button"
                className={styles.dangerBtn}
                onClick={() => cancelReserva(selected._id)}
                disabled={selected.status === "CANCELLED"}
              >
                Cancelar
              </button>

              <button type="button" className={styles.ghostBtn} onClick={() => setOpenId(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}