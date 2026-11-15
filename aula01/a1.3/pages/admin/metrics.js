// pages/admin/metrics.js
// As métricas agora fazem parte da tela "Resumo" (/admin/dashboard).
// Esta página só redireciona, para links antigos continuarem funcionando.
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function AdminMetricsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);

  return null;
}