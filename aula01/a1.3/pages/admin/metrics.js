// pages/admin/metrics.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/AdminLayout";

function moneyBR(value) {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AdminMetricsPage() {
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
        credentials: "include",
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminLayout title="Métricas">
      <div style={{ padding: 16 }}>
        <h1 style={{ margin: 0 }}>Métricas</h1>
        <p style={{ marginTop: 6, opacity: 0.8 }}>Resumo financeiro e reservas.</p>

        {loading ? <p>Carregando...</p> : null}
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

        {data ? (
          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <div><b>Total de reservas:</b> {data.totalReservas}</div>
            <div><b>Confirmadas:</b> {data.confirmadas}</div>
            <div><b>Pendentes:</b> {data.pendentes}</div>
            <div><b>Canceladas:</b> {data.canceladas}</div>

            <hr />

            <div><b>Receita total (confirmadas):</b> {moneyBR(data.receitaTotal)}</div>
            <div><b>Receita do mês:</b> {moneyBR(data.receitaMes)}</div>
            <div><b>Receita pendente:</b> {moneyBR(data.receitaPendente)}</div>

            <div><b>Entradas pagas:</b> {moneyBR(data.entradasPagas)}</div>
            <div><b>Entradas pendentes (não pagas):</b> {moneyBR(data.entradasPendentesNaoPagas)}</div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}