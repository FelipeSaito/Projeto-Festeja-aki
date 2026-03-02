// pages/admin/dashboard.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/AdminLayout";
import styles from "../../styles/adminDashboard.module.css";

function moneyBR(value) {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return "-";
  const [y, m, d] = String(yyyy_mm_dd).split("-");
  if (!y || !m || !d) return String(yyyy_mm_dd);
  return `${d}/${m}/${y}`;
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
      const r = await fetch("/api/admin/metrics", { method: "GET" });
      const j = await r.json();

      if (!r.ok || !j.ok) {
        if (r.status === 401) {
          router.push("/admin/login");
          return;
        }
        throw new Error(j.error || "Falha ao carregar métricas");
      }

      setData(j.data);
    } catch (e) {
      setError(e.message || "Erro inesperado");
    } finally {
      setLoading(false);
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
            <p className={styles.sub}>
              Visão rápida das reservas e faturamento.
            </p>
          </div>

          <button className={styles.refreshBtn} onClick={load} disabled={loading}>
            {loading ? "Carregando..." : "Atualizar"}
          </button>
        </div>

        {error ? <div className={styles.alert}>{error}</div> : null}

        {/* Cards */}
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
            <div className={styles.kpiLabel}>Receita do mês (confirmadas)</div>
            <div className={styles.kpiValue}>{moneyBR(data?.receitaMes)}</div>
            <div className={styles.kpiHint}>
              Entradas no mês: <b>{moneyBR(data?.entradasMes)}</b>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.kpiLabel}>Receita total (confirmadas)</div>
            <div className={styles.kpiValue}>{moneyBR(data?.receitaTotal)}</div>
            <div className={styles.kpiHint}>
              Entradas total: <b>{moneyBR(data?.entradasTotal)}</b>
            </div>
          </div>
        </div>

        {/* Mini gráfico */}
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

        {/* Próximas */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Próximas reservas confirmadas</div>

          <div className={styles.table}>
            <div className={styles.thead}>
              <div>Data</div>
              <div>Cliente</div>
              <div>WhatsApp</div>
              <div>Total</div>
            </div>

            {(data?.proximas || []).length === 0 ? (
              <div className={styles.empty}>Nenhuma reserva confirmada futura.</div>
            ) : (
              (data?.proximas || []).map((r) => (
                <div className={styles.trow} key={r._id}>
                  <div>{formatDateBR(r.dataReserva)}</div>
                  <div>{r?.customerId?.nome || "-"}</div>
                  <div className={styles.mono}>{r?.customerId?.whatsapp || "-"}</div>
                  <div>{moneyBR(r.valorTotal)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}