// pages/admin/limpeza.js
// Tela "Limpeza": checklist de cada festa confirmada, para marcar no salão.
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/AdminLayout";
import layoutStyles from "../../styles/admin.module.css";
import styles from "../../styles/adminLimpeza.module.css";

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// "2026-11-20" -> { dia: "sexta", data: "20/11" }
function partesDaData(dataISO) {
  const [ano, mes, dia] = String(dataISO || "").split("-").map(Number);
  if (!ano || !mes || !dia) return { dia: "", data: String(dataISO || "-") };

  return {
    dia: DIAS[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()],
    data: `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`,
  };
}

function maiuscula(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}

// "Sexta, 20/11" ou "Domingo, 22/11 de manhã"
function tituloLimpeza(limpeza) {
  const { dia, data } = partesDaData(limpeza.dataLimpeza);
  const base = `${maiuscula(dia)}, ${data}`;
  return limpeza.periodo === "manha" ? `${base} de manhã` : base;
}

// "sábado, 21/11"
function dataDaFesta(limpeza) {
  const { dia, data } = partesDaData(limpeza.dataReserva);
  return `${dia}, ${data}`;
}

// "pronta" | "hoje" | "atrasada" | "futura"
function situacao(limpeza, hoje) {
  if (limpeza.concluida) return "pronta";
  if (limpeza.dataLimpeza === hoje) return "hoje";
  if (limpeza.dataLimpeza < hoje) return "atrasada";
  return "futura";
}

const SELOS = {
  pronta: "Salão pronto",
  hoje: "Hoje",
  atrasada: "Atrasada",
};

/* ===== WhatsApp ===== */
function normalizeBRPhone(raw = "") {
  const d = String(raw).replace(/\D/g, "");
  if (!d) return "";
  return d.length === 11 ? `55${d}` : d;
}

// Link público da página de acompanhamento do cliente (/reserva/<código>).
// Usa o endereço em que o painel está aberto. Vazio se a reserva não tiver código.
function linkAcompanhamento(limpeza) {
  const token = limpeza?.tokenAcompanhamento;
  if (!token || typeof window === "undefined") return "";
  return `${window.location.origin}/reserva/${token}`;
}

function avisarCliente(limpeza) {
  const phone = normalizeBRPhone(limpeza?.cliente?.whatsapp);
  if (!phone) return false;

  const primeiroNome = String(limpeza.cliente.nome || "").trim().split(" ")[0] || "";
  const link = linkAcompanhamento(limpeza);
  const rodape = link ? `\nAcompanhe a sua reserva por aqui:\n${link}\n` : "";

  const msg = `
Olá${primeiroNome ? `, ${primeiroNome}` : ""}! Tudo bem?

O salão Festeja Aki já está limpo e preparado para a sua festa de ${dataDaFesta(limpeza)}.

A entrada é a partir das 09:30. Qualquer dúvida, é só chamar.
${rodape}`;

  const url = new URL("https://api.whatsapp.com/send");
  url.searchParams.set("phone", phone);
  url.searchParams.set("text", msg.trim());

  window.open(url.toString(), "_blank", "noopener,noreferrer");
  return true;
}

export default function AdminLimpezaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [limpezas, setLimpezas] = useState([]);
  const [hoje, setHoje] = useState("");
  const [error, setError] = useState("");

  async function carregar() {
    try {
      setError("");
      setLoading(true);

      const res = await fetch("/api/admin/checklist", {
        method: "GET",
        credentials: "include",
      });

      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j?.error || "Erro ao carregar o checklist");

      setLimpezas(Array.isArray(j.limpezas) ? j.limpezas : []);
      setHoje(j.hoje || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Aplica na tela o estado de um item e recalcula o progresso do cartão
  function aplicarItem(reservaId, itemId, feito) {
    setLimpezas((prev) =>
      prev.map((limpeza) => {
        if (limpeza.reservaId !== reservaId) return limpeza;

        const itens = limpeza.itens.map((item) =>
          item.id === itemId ? { ...item, feito } : item
        );
        const feitos = itens.filter((item) => item.feito).length;

        return { ...limpeza, itens, feitos, concluida: feitos === itens.length };
      })
    );
  }

  async function marcarItem(limpeza, item) {
    const novo = !item.feito;

    // Marca na hora; se o servidor recusar, volta ao que era
    aplicarItem(limpeza.reservaId, item.id, novo);
    setError("");

    try {
      const res = await fetch("/api/admin/checklist", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservaId: limpeza.reservaId, itemId: item.id, feito: novo }),
      });

      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j?.error || "Não foi possível salvar o item");
    } catch (err) {
      aplicarItem(limpeza.reservaId, item.id, !novo);
      setError(err.message);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminLayout
      title="Limpeza"
      subtitle="O que falta fazer antes de cada festa."
      actions={
        <button
          type="button"
          className={layoutStyles.headerBtn}
          onClick={carregar}
          disabled={loading}
          aria-label="Atualizar checklist"
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
        {error && (
          <div className={styles.alert} role="alert">
            {error}
          </div>
        )}

        {loading && limpezas.length === 0 ? (
          <p className={styles.vazio}>Carregando o checklist...</p>
        ) : limpezas.length === 0 ? (
          <p className={styles.vazio}>
            Nenhuma limpeza por enquanto. Quando uma reserva for confirmada, a limpeza dela
            aparece aqui.
          </p>
        ) : (
          limpezas.map((limpeza) => {
            const estado = situacao(limpeza, hoje);
            const porcento = limpeza.total > 0 ? (limpeza.feitos / limpeza.total) * 100 : 0;

            return (
              <section
                key={limpeza.reservaId}
                className={`${styles.cartao} ${styles["c_" + estado] || ""}`}
              >
                <div className={styles.topo}>
                  <div>
                    <h2 className={styles.titulo}>{tituloLimpeza(limpeza)}</h2>
                    <p className={styles.sub}>
                      Festa de {limpeza.cliente.nome} no {dataDaFesta(limpeza)}
                    </p>
                  </div>

                  {SELOS[estado] && (
                    <span className={`${styles.selo} ${styles["s_" + estado] || ""}`}>
                      {SELOS[estado]}
                    </span>
                  )}
                </div>

                <div className={styles.progresso}>
                  <div
                    className={styles.barra}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={limpeza.total}
                    aria-valuenow={limpeza.feitos}
                    aria-label="Itens concluídos"
                  >
                    <div className={styles.barraCheia} style={{ width: `${porcento}%` }} />
                  </div>
                  <span className={styles.contagem}>
                    {limpeza.feitos} de {limpeza.total}
                  </span>
                </div>

                <ul className={styles.itens}>
                  {limpeza.itens.map((item) => (
                    <li key={item.id}>
                      <label className={`${styles.item} ${item.feito ? styles.itemFeito : ""}`}>
                        <input
                          type="checkbox"
                          checked={item.feito}
                          onChange={() => marcarItem(limpeza, item)}
                        />
                        <span>{item.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>

                {limpeza.concluida && (
                  <div className={styles.acoes}>
                    {limpeza.cliente.whatsapp ? (
                      <button
                        type="button"
                        className={styles.avisarBtn}
                        onClick={() => avisarCliente(limpeza)}
                      >
                        Avisar cliente no WhatsApp
                      </button>
                    ) : (
                      <p className={styles.sub}>Este cliente não tem WhatsApp cadastrado.</p>
                    )}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </AdminLayout>
  );
}