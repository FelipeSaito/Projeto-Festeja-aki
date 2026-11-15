// pages/api/admin/metrics.js
// API ADMIN: indicadores do painel. O formato da resposta deve ser preservado:
// os campos antigos continuam iguais e os novos ficam dentro de "painel".
import { requireAdminCookie } from "../../../lib/auth";
import {
  listarReservas,
  todayInBrazil,
  responderErro,
  STATUS,
} from "../../../lib/reservasService";

function money(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function soma(lista, campo) {
  return lista.reduce((total, r) => total + money(r[campo]), 0);
}

function doisDigitos(n) {
  return String(n).padStart(2, "0");
}

// Date (UTC) -> "YYYY-MM-DD"
function paraISO(date) {
  return `${date.getUTCFullYear()}-${doisDigitos(date.getUTCMonth() + 1)}-${doisDigitos(
    date.getUTCDate()
  )}`;
}

// "YYYY-MM" do mês atual e dos 5 anteriores (fuso de São Paulo)
function ultimosSeisMeses(hojeISO) {
  const [year, month] = hojeISO.split("-").map(Number);
  const meses = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    meses.push(`${d.getUTCFullYear()}-${doisDigitos(d.getUTCMonth() + 1)}`);
  }

  return meses;
}

// Todos os sábados e domingos de um mês, como "YYYY-MM-DD" (mes: 1 a 12)
function fimDeSemanaDoMes(ano, mes) {
  const datas = [];
  const d = new Date(Date.UTC(ano, mes - 1, 1));

  while (d.getUTCMonth() === mes - 1) {
    if ([0, 6].includes(d.getUTCDay())) datas.push(paraISO(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return datas;
}

// Próximos sábados e domingos livres, a partir de amanhã
function proximasDatasLivres(hojeISO, ocupadas, quantidade = 6, limiteDias = 180) {
  const [ano, mes, dia] = hojeISO.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  const livres = [];

  for (let i = 0; i < limiteDias && livres.length < quantidade; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    const iso = paraISO(d);
    if ([0, 6].includes(d.getUTCDay()) && !ocupadas.has(iso)) livres.push(iso);
  }

  return livres;
}

export default async function handler(req, res) {
  const admin = requireAdminCookie(req, res);
  if (!admin) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  try {
    const reservas = await listarReservas();

    const hoje = todayInBrazil();
    const mesAtual = hoje.slice(0, 7); // "YYYY-MM"
    const meses = ultimosSeisMeses(hoje);

    const temData = (r) => typeof r.dataReserva === "string";

    const pendentesLista = reservas.filter((r) => r.status === STATUS.PENDING);
    const confirmadasLista = reservas.filter((r) => r.status === STATUS.CONFIRMED);
    const canceladasLista = reservas.filter((r) => r.status === STATUS.CANCELLED);

    const confirmadasMes = confirmadasLista.filter(
      (r) => temData(r) && r.dataReserva.startsWith(mesAtual)
    );

    // 1. Quantidades
    const totalReservas = reservas.length;
    const pendentes = pendentesLista.length;
    const confirmadas = confirmadasLista.length;
    const canceladas = canceladasLista.length;
    const conversao = totalReservas > 0 ? confirmadas / totalReservas : 0;

    // 2. Receitas confirmadas
    const receitaTotal = soma(confirmadasLista, "valorTotal");
    const receitaMes = soma(confirmadasMes, "valorTotal");
    const entradasTotalConfirmadas = soma(confirmadasLista, "valorEntrada");
    const entradasMesConfirmadas = soma(confirmadasMes, "valorEntrada");

    // 3. Pendências
    const receitaPendente = soma(pendentesLista, "valorTotal");
    const entradasPendentesTotal = soma(pendentesLista, "valorEntrada");
    const entradasPendentesNaoPagas = soma(
      pendentesLista.filter((r) => r.entradaPaga === false),
      "valorEntrada"
    );

    // 4. Entradas efetivamente marcadas como pagas
    const entradasPagas = soma(
      reservas.filter((r) => r.entradaPaga === true),
      "valorEntrada"
    );

    // 5. Próximas reservas ativas (já com o cliente em customerId)
    const proximas = reservas
      .filter(
        (r) =>
          [STATUS.PENDING, STATUS.CONFIRMED].includes(r.status) &&
          temData(r) &&
          r.dataReserva >= hoje
      )
      .sort((a, b) => a.dataReserva.localeCompare(b.dataReserva))
      .slice(0, 10);

    // 6. Reservas por mês (últimos seis meses)
    const reservasPorMes = meses.map((month) => ({
      month,
      total: reservas.filter((r) => temData(r) && r.dataReserva.startsWith(month)).length,
    }));

    // ============================================================
    // 7. Painel "Resumo" (campos novos)
    //    Regra: festa confirmada conta como faturada, no mês da festa.
    // ============================================================

    // Datas ocupadas: confirmadas, ou pendentes com o prazo do sinal ainda valendo
    const datasConfirmadas = new Set(
      confirmadasLista.filter(temData).map((r) => r.dataReserva)
    );
    const datasPendentes = new Set(
      pendentesLista.filter((r) => temData(r) && !r.vencida).map((r) => r.dataReserva)
    );
    const ocupadas = new Set([...datasConfirmadas, ...datasPendentes]);

    // Mês atual: cada sábado e domingo com a sua situação
    const [anoAtual, numeroMesAtual] = mesAtual.split("-").map(Number);

    const datasDoMes = fimDeSemanaDoMes(anoAtual, numeroMesAtual).map((data) => {
      let estado = "livre";

      if (datasConfirmadas.has(data)) estado = "reservada";
      else if (datasPendentes.has(data)) estado = "pendente";
      else if (data <= hoje) estado = "passada"; // hoje sem festa já não dá para vender

      return { data, estado };
    });

    // Quanto ainda falta receber das festas confirmadas que vão acontecer
    const aReceber = confirmadasLista
      .filter((r) => temData(r) && r.dataReserva >= hoje)
      .reduce(
        (total, r) =>
          total + money(r.valorTotal) - (r.entradaPaga ? money(r.valorEntrada) : 0),
        0
      );

    // Pedidos pendentes sem sinal, com o prazo de 24h ainda correndo
    const aguardandoSinal = pendentesLista
      .filter((r) => !r.entradaPaga && !r.vencida && temData(r) && r.dataReserva >= hoje)
      .sort((a, b) => String(a.expiraEm ?? "").localeCompare(String(b.expiraEm ?? "")))
      .slice(0, 10);

    // Ano atual e o próximo, mês a mês
    const anos = [anoAtual, anoAtual + 1].map((ano) => {
      const prefixoAno = `${ano}-`;
      const confirmadasAno = confirmadasLista.filter(
        (r) => temData(r) && r.dataReserva.startsWith(prefixoAno)
      );

      let disponiveis = 0;

      const mesesDoAno = Array.from({ length: 12 }, (_, i) => {
        const month = `${ano}-${doisDigitos(i + 1)}`;
        const doMes = confirmadasAno.filter((r) => r.dataReserva.startsWith(month));

        disponiveis += fimDeSemanaDoMes(ano, i + 1).length;

        return {
          month,
          festas: doMes.length,
          faturamento: soma(doMes, "valorTotal"),
        };
      });

      return {
        ano,
        faturamento: soma(confirmadasAno, "valorTotal"),
        reservadas: confirmadasAno.length,
        disponiveis,
        meses: mesesDoAno,
      };
    });

    const painel = {
      hoje,
      mes: {
        id: mesAtual,
        faturamento: receitaMes,
        reservadas: datasDoMes.filter((d) => d.estado === "reservada").length,
        disponiveis: datasDoMes.length,
        datas: datasDoMes,
      },
      aReceber,
      aguardandoSinal,
      datasLivres: proximasDatasLivres(hoje, ocupadas),
      anos,
    };

    return res.status(200).json({
      ok: true,
      data: {
        totalReservas,
        pendentes,
        confirmadas,
        canceladas,
        conversao,

        receitaTotal,
        receitaMes,
        receitaPendente,

        entradasPagas,
        entradasTotalConfirmadas,
        entradasMesConfirmadas,

        entradasPendentesTotal,
        entradasPendentesNaoPagas,

        proximas,
        reservasPorMes,

        painel,
      },
    });
  } catch (err) {
    return responderErro(res, err, "Erro ao gerar métricas.");
  }
}