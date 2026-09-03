import { getBranding, getUnidades, getProfissionais, getServicos } from "@/lib/data";
import { isAdminAutenticado } from "@/lib/admin";
import AdminLogin from "@/components/AdminLogin";
import AdminDashboard from "@/components/AdminDashboard";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

// Sem cache: a sessão do admin (cookie) decide o que renderizar.
export const dynamic = "force-dynamic";

export default function AdminPage() {
  const branding = getBranding(TENANT);
  if (!branding) return <div className="app"><div className="body">Barbearia não encontrada.</div></div>;

  if (!isAdminAutenticado()) {
    return <AdminLogin branding={branding} />;
  }

  return (
    <AdminDashboard
      slug={TENANT}
      branding={branding}
      unidades={getUnidades(TENANT)}
      profissionais={getProfissionais(TENANT)}
      servicos={getServicos(TENANT)}
    />
  );
}
