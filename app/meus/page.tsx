import { getBranding, getUnidades, getProfissionais, getServicos } from "@/lib/data";
import MyBookings from "@/components/MyBookings";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

export default function MeusPage() {
  const branding = getBranding(TENANT);
  if (!branding) return <div className="app"><div className="body">Barbearia não encontrada.</div></div>;

  return (
    <MyBookings
      slug={TENANT}
      branding={branding}
      unidades={getUnidades(TENANT)}
      profissionais={getProfissionais(TENANT)}
      servicos={getServicos(TENANT)}
    />
  );
}
