// pages/admin/dashboard.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/AdminLayout";
import styles from "../../styles/adminDashboard.module.css";
// pages/api/admin/dashboard.js
export { default } from "./metrics";

function moneyBR(value) {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function pctBR(value) {
  const n = Number(value || 0);
  return (n * 100).toFixed(0) + "%";
}
function formatDateBR(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return "-";
  const [y, m, d] = String(yyyy_mm_dd).split("-");
  if (!y || !m || !d) return String(yyyy_mm_dd);
  return `${d}/${m}/${y}`;
}
function statusLabel(s) {
  if (s === "CONFIRMED") return "Confirmada";
  if (s === "PENDING") return "Pendente";
  if (s === "CANCELLED") return "Cancelada";
  return s || "-";
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const r = await fetch("/api/admin/metrics", {
        method: "GET",
        credentials: "include", // ✅ importante: manda cookie do admin
        headers: { "Content-Type": "application/json" },
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j.ok) {
        if (r.status === 401) {
          router.push("/admin/login");
          return;
        }
        throw new Error(j?.error || "Falha ao carregar métricas");
      }

      setData(j.data);
    } catch (e) {
      setError(e?.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function markEntryPaid(reservaId) {
    try {
      const r = await fetch(`/api/admin/reservas/${reservaId}`, {
        method: "PATCH",
        credentials: "include", // ✅ importante: manda cookie do admin
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "MARK_ENTRY_PAID" }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j.ok) {
        if (r.status === 401) {
          router.push("/admin/login");
          return;
        }
        throw new Error(j?.error || "Falha ao marcar entrada paga");
      }

      await load(); // recarrega métricas
    } catch (e) {
      alert(e?.message || "Erro");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxBar = Math.max(...(data?.reservasPorMes || []).map((x) => x.total), 1);

  return (
    <AdminLayout title="Dashboard">
      <div className={styles.page}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.h1}>Dashboard</h1>
            <p className={styles.sub}>Métricas do salão e próximas reservas.</p>
          </div>

          <button className={styles.refreshBtn} onClick={load} disabled={loading}>
            {loading ? "Carregando..." : "Atualizar"}
          </button>
        </div>

        {error ? <div className={styles.alert}>{error}</div> : null}

        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.kpiLabel}>Total de reservas</div>
            <div className={styles.kpiValue}>{data?.totalReservas ?? "-"}</div>
          </div>

          <div className={styles.card}>
            <div className={styles.kpiLabel}>Confirmadas</div>
            <div className={styles.kpiValue}>{data?.confirmadas ?? "-"}</div>
          </div>

          <div className={styles.card}>
            <div className={styles.kpiLabel}>Pendentes</div>
            <div className={styles.kpiValue}>{data?.pendentes ?? "-"}</div>
          </div>

          <div className={styles.card}>
            <div className={styles.kpiLabel}>Canceladas</div>
            <div className={styles.kpiValue}>{data?.canceladas ?? "-"}</div>
          </div>

          <div className={styles.card}>
            <div className={styles.kpiLabel}>Taxa de conversão</div>
            <div className={styles.kpiValue}>{pctBR(data?.conversao)}</div>
            <div className={styles.kpiHint}>Confirmadas / Total</div>
          </div>

          <div className={styles.card}>
            <div className={styles.kpiLabel}>Receita do mês (confirmadas)</div>
            <div className={styles.kpiValue}>{moneyBR(data?.receitaMes)}</div>
            <div className={styles.kpiHint}>
              Entradas no mês: <b>{moneyBR(data?.entradasMesConfirmadas)}</b>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.kpiLabel}>Receita total (confirmadas)</div>
            <div className={styles.kpiValue}>{moneyBR(data?.receitaTotal)}</div>
            <div className={styles.kpiHint}>
              Entradas total: <b>{moneyBR(data?.entradasTotalConfirmadas)}</b>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.kpiLabel}>Receita pendente (PENDING)</div>
            <div className={styles.kpiValue}>{moneyBR(data?.receitaPendente)}</div>
            <div className={styles.kpiHint}>
              Entradas pendentes: <b>{moneyBR(data?.entradasPendentesTotal)}</b>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.kpiLabel}>Entradas pagas</div>
            <div className={styles.kpiValue}>{moneyBR(data?.entradasPagas)}</div>
            <div className={styles.kpiHint}>
              Ainda não pagas (PENDING): <b>{moneyBR(data?.entradasPendentesNaoPagas)}</b>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Reservas nos últimos 6 meses</div>
          <div className={styles.bars}>
            {(data?.reservasPorMes || []).map((item) => {
              const pct = Math.round((item.total / maxBar) * 100);
              return (
                <div className={styles.barItem} key={item.month}>
                  <div className={styles.barTop}>{item.total}</div>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ height: `${pct}%` }} />
                  </div>
                  <div className={styles.barLabel}>{item.month}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Próximas reservas</div>

          <div className={styles.thead}>
            <div>Data</div>
            <div>Cliente</div>
            <div>Status</div>
            <div>Entrada</div>
            <div>Total</div>
          </div>

          {(data?.proximas || []).length === 0 ? (
            <div className={styles.empty}>Nenhuma reserva futura.</div>
          ) : (
            (data?.proximas || []).map((r) => (
              <div className={styles.trow} key={r._id}>
                <div>{formatDateBR(r.dataReserva)}</div>
                <div>{r?.customerId?.nome || "-"}</div>
                <div>{statusLabel(r.status)}</div>

                {/* ✅ Entrada: mostra valor + botão se quiser habilitar aqui */}
                <div>
                  {r?.entradaPaga ? (
                    <button className={styles.paidBtn} disabled>
                      Pago ✅
                    </button>
                  ) : (
                    <button
                      className={styles.payBtn}
                      onClick={() => markEntryPaid(r._id)}
                      disabled={loading}
                      title="Marcar entrada como paga"
                    >
                      Marcar
                    </button>
                  )}
                  <span style={{ marginLeft: 8 }}>{moneyBR(r?.valorEntrada)}</span>
                </div>

                {/* ✅ Total */}
                <div>{moneyBR(r?.valorTotal)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}