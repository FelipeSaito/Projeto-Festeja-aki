// pages/admin/dashboard.js
// Tela "Resumo": o que precisa de atenção, próximas festas, faturamento e ocupação.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AdminLayout from "../../components/AdminLayout";
import layoutStyles from "../../styles/admin.module.css";
import styles from "../../styles/adminDashboard.module.css";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

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
// "2027-02-07" -> "dom, 07/02/2027"
function formatDateComDia(yyyy_mm_dd) {
  const [y, m, d] = String(yyyy_mm_dd || "").split("-").map(Number);
  if (!y || !m || !d) return formatDateBR(yyyy_mm_dd);
  const dia = DIAS_CURTOS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dia}, ${formatDateBR(yyyy_mm_dd)}`;
}
// "2026-11-21" -> "sáb 21/11"
function formatDateCurta(yyyy_mm_dd) {
  const [y, m, d] = String(yyyy_mm_dd || "").split("-").map(Number);
  if (!y || !m || !d) return String(yyyy_mm_dd || "-");
  const dia = DIAS_CURTOS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dia} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}
function statusLabel(s) {
  if (s === "CONFIRMED") return "Confirmada";
  if (s === "PENDING") return "Pendente";
  if (s === "CANCELLED") return "Cancelada";
  return s || "-";
}
// "faltam 5h 20min" | "faltam 12min" | "prazo vencido"
function textoPrazo(expiraEm, agoraMs) {
  const fim = Date.parse(expiraEm);
  if (Number.isNaN(fim)) return "";

  const ms = fim - agoraMs;
  if (ms <= 0) return "prazo vencido";

  const horas = Math.floor(ms / 3600000);
  const minutos = Math.floor((ms % 3600000) / 60000);

  return horas > 0 ? `faltam ${horas}h ${minutos}min` : `faltam ${minutos}min`;
}

const ESTADO_DATA = {
  reservada: "Reservada",
  pendente: "Aguardando sinal",
  livre: "Livre",
  passada: "Passou sem festa",
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [anoSelecionado, setAnoSelecionado] = useState(null);
  const [agoraMs, setAgoraMs] = useState(() => Date.now());

  async function load() {
    setLoading(true);
    setError("");

    try {
      const r = await fetch("/api/admin/metrics", {
        method: "GET",
        credentials: "include", // ✅ manda cookie do admin
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
      setAgoraMs(Date.now());
    } catch (e) {
      setError(e?.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function markEntryPaid(reservaId) {
    if (!window.confirm("Registrar o pagamento do sinal?")) return;

    try {
      const r = await fetch(`/api/admin/reservas/${reservaId}`, {
        method: "PATCH",
        credentials: "include", // ✅ manda cookie do admin
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

  // Atualiza o contador de prazo a cada minuto
  useEffect(() => {
    const timer = setInterval(() => setAgoraMs(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const painel = data?.painel || null;
  const proximas = (data?.proximas || []).slice(0, 5);
  const aguardando = painel?.aguardandoSinal || [];
  const anos = painel?.anos || [];
  const ano = anos.find((a) => a.ano === anoSelecionado) || anos[0] || null;
  const maxFestas = Math.max(...(ano?.meses || []).map((m) => m.festas), 1);
  const nomeDoMes = painel?.mes?.id ? MESES[Number(painel.mes.id.slice(5, 7)) - 1] : "";

  return (
    <AdminLayout
      title="Resumo"
      subtitle="Como o salão está hoje."
      actions={
        <button
          type="button"
          className={layoutStyles.headerBtn}
          onClick={load}
          disabled={loading}
          aria-label="Atualizar resumo"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 11a8 8 0 1 0-2.3 6.3M20 5v6h-6" />
          </svg>
          <span className={layoutStyles.headerBtnLabel}>
            {loading ? "Atualizando..." : "Atualizar"}
          </span>
        </button>
      }
    >
      <div className={styles.page}>
        {error ? (
          <div className={styles.alert} role="alert">
            {error}
          </div>
        ) : null}

        {loading && !data ? <p className={styles.loading}>Carregando o resumo...</p> : null}

        {data && !painel ? (
          <div className={styles.alert} role="alert">
            O servidor ainda não enviou os dados do resumo. Publique também o arquivo
            pages/api/admin/metrics.js.
          </div>
        ) : null}

        {painel ? (
          <>
            {/* 1. O que precisa de atenção */}
            {aguardando.length > 0 && (
              <section className={`${styles.bloco} ${styles.blocoAviso}`}>
                <h2 className={styles.blocoTitulo}>
                  Aguardando sinal ({aguardando.length})
                </h2>

                <div className={styles.lista}>
                  {aguardando.map((r) => (
                    <div className={styles.linha} key={r._id}>
                      <div>
                        <div className={styles.linhaPrincipal}>
                          {r?.customerId?.nome || "Cliente"}
                        </div>
                        <div className={styles.linhaSub}>
                          Festa em {formatDateComDia(r.dataReserva)}
                        </div>
                      </div>
                      <div className={styles.prazo}>{textoPrazo(r.expiraEm, agoraMs)}</div>
                    </div>
                  ))}
                </div>

                <Link className={styles.linkAcao} href="/admin/reservas">
                  Registrar sinal em Reservas
                </Link>
              </section>
            )}

            {/* 2. Próximas festas */}
            <section className={styles.bloco}>
              <h2 className={styles.blocoTitulo}>Próximas festas</h2>

              {proximas.length === 0 ? (
                <p className={styles.vazio}>Nenhuma festa marcada daqui para frente.</p>
              ) : (
                <div className={styles.lista}>
                  {proximas.map((r) => (
                    <div className={styles.linha} key={r._id}>
                      <div>
                        <div className={styles.linhaPrincipal}>
                          {formatDateComDia(r.dataReserva)}
                        </div>
                        <div className={styles.linhaSub}>{r?.customerId?.nome || "-"}</div>
                      </div>

                      <div className={styles.linhaLado}>
                        <span className={`${styles.status} ${styles["s_" + r.status] || ""}`}>
                          {statusLabel(r.status)}
                        </span>

                        {r?.entradaPaga ? (
                          <span className={styles.paidTag}>Sinal pago</span>
                        ) : r.status === "CONFIRMED" ? (
                          <button
                            type="button"
                            className={styles.payBtn}
                            onClick={() => markEntryPaid(r._id)}
                            disabled={loading}
                          >
                            Marcar sinal pago
                          </button>
                        ) : (
                          <span className={styles.linhaSub}>Sinal não pago</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. Faturamento do mês */}
            <section className={`${styles.bloco} ${styles.blocoDestaque}`}>
              <div className={styles.numeros}>
                <div>
                  <div className={styles.rotulo}>Faturamento de {nomeDoMes.toLowerCase()}</div>
                  <div className={styles.valorGrande}>{moneyBR(painel.mes.faturamento)}</div>
                </div>

                <div>
                  <div className={styles.rotulo}>A receber das próximas festas</div>
                  <div className={styles.valorMedio}>{moneyBR(painel.aReceber)}</div>
                </div>
              </div>
            </section>

            {/* 4. Ocupação do mês */}
            <section className={styles.bloco}>
              <h2 className={styles.blocoTitulo}>Datas de {nomeDoMes.toLowerCase()}</h2>

              <p className={styles.frase}>
                <strong>
                  {painel.mes.reservadas} de {painel.mes.disponiveis}
                </strong>{" "}
                datas reservadas
              </p>

              <div className={styles.datas}>
                {painel.mes.datas.map((d) => (
                  <div
                    key={d.data}
                    className={`${styles.dataItem} ${styles["d_" + d.estado] || ""}`}
                    title={`${formatDateCurta(d.data)}: ${ESTADO_DATA[d.estado] || d.estado}`}
                  >
                    <span className={styles.dataDia}>{d.data.slice(8, 10)}</span>
                    <span className={styles.dataSemana}>{formatDateCurta(d.data).slice(0, 3)}</span>
                  </div>
                ))}
              </div>

              <div className={styles.legenda}>
                <span>
                  <i className={`${styles.legendaCor} ${styles.d_reservada}`} /> Reservada
                </span>
                <span>
                  <i className={`${styles.legendaCor} ${styles.d_pendente}`} /> Aguardando sinal
                </span>
                <span>
                  <i className={`${styles.legendaCor} ${styles.d_livre}`} /> Livre
                </span>
              </div>
            </section>

            {/* 5. Próximas datas livres */}
            <section className={styles.bloco}>
              <h2 className={styles.blocoTitulo}>Próximas datas livres</h2>

              {painel.datasLivres.length === 0 ? (
                <p className={styles.vazio}>Nenhuma data livre nos próximos meses.</p>
              ) : (
                <div className={styles.chips}>
                  {painel.datasLivres.map((d) => (
                    <span className={styles.chip} key={d}>
                      {formatDateCurta(d)}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* 6. O ano, mês a mês */}
            {ano && (
              <section className={styles.bloco}>
                <div className={styles.anoTopo}>
                  <h2 className={styles.blocoTitulo}>O ano</h2>

                  <div className={styles.anoBotoes} role="group" aria-label="Escolher o ano">
                    {anos.map((a) => (
                      <button
                        key={a.ano}
                        type="button"
                        className={`${styles.anoBtn} ${a.ano === ano.ano ? styles.anoBtnAtivo : ""}`}
                        onClick={() => setAnoSelecionado(a.ano)}
                        aria-pressed={a.ano === ano.ano}
                      >
                        {a.ano}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.numeros}>
                  <div>
                    <div className={styles.rotulo}>Faturamento em {ano.ano}</div>
                    <div className={styles.valorMedio}>{moneyBR(ano.faturamento)}</div>
                  </div>

                  <div>
                    <div className={styles.rotulo}>Datas reservadas</div>
                    <div className={styles.valorMedio}>
                      {ano.reservadas} de {ano.disponiveis}
                    </div>
                  </div>
                </div>

                <div className={styles.bars} aria-label={`Festas por mês em ${ano.ano}`}>
                  {ano.meses.map((m, i) => (
                    <div
                      className={styles.barItem}
                      key={m.month}
                      title={`${MESES[i]}: ${m.festas} festa(s), ${moneyBR(m.faturamento)}`}
                    >
                      <div className={styles.barTop}>{m.festas > 0 ? m.festas : ""}</div>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{ height: `${Math.round((m.festas / maxFestas) * 100)}%` }}
                        />
                      </div>
                      <div className={styles.barLabel}>{MESES_CURTOS[i]}</div>
                    </div>
                  ))}
                </div>

                <p className={styles.nota}>Festas confirmadas em cada mês.</p>
              </section>
            )}
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}