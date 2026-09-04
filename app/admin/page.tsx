import { getBranding, getUnidades, getProfissionais, getServicos } from "@/lib/data";
import { getSessao } from "@/lib/admin";
import AdminLogin from "@/components/AdminLogin";
import AdminDashboard from "@/components/AdminDashboard";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

// Sem cache: a sessão (cookie) decide o que renderizar.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const branding = await getBranding(TENANT);
  if (!branding) return <div className="app"><div className="body">Barbearia não encontrada.</div></div>;

  const sessao = await getSessao();
  if (!sessao) return <AdminLogin branding={branding} />;

  const [unidades, profissionais, servicos] = await Promise.all([
    getUnidades(TENANT),
    getProfissionais(TENANT),
    getServicos(TENANT),
  ]);

  return (
    <AdminDashboard
      slug={TENANT}
      branding={branding}
      unidades={unidades}
      profissionais={profissionais}
      servicos={servicos}
      role={sessao.role}
      profId={sessao.role === "prof" ? sessao.profId : ""}
      profNome={sessao.role === "prof" ? sessao.profNome : ""}
    />
  );
}
