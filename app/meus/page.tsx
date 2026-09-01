import { getBranding, getUnidades, getProfissionais, getServicos } from "@/lib/data";
import MyBookings from "@/components/MyBookings";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

export default function MeusPage({ searchParams }: { searchParams: { tel?: string } }) {
  const branding = getBranding(TENANT);
  if (!branding) return <div className="app"><div className="body">Barbearia não encontrada.</div></div>;

  const telInicial = (searchParams?.tel || "").replace(/\D/g, "").slice(0, 11);

  return (
    <MyBookings
      slug={TENANT}
      branding={branding}
      unidades={getUnidades(TENANT)}
      profissionais={getProfissionais(TENANT)}
      servicos={getServicos(TENANT)}
      telInicial={telInicial}
    />
  );
}
