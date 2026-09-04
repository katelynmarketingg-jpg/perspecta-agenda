import { getBranding, getUnidades, getProfissionais, getServicos } from "@/lib/data";
import MyBookings from "@/components/MyBookings";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

// Catálogo vem do banco: sem prerender, senão congela no build.
export const dynamic = "force-dynamic";

export default async function MeusPage({ searchParams }: { searchParams: { tel?: string } }) {
  const [branding, unidades, profissionais, servicos] = await Promise.all([
    getBranding(TENANT),
    getUnidades(TENANT),
    getProfissionais(TENANT),
    getServicos(TENANT),
  ]);
  if (!branding) return <div className="app"><div className="body">Barbearia não encontrada.</div></div>;

  const telInicial = (searchParams?.tel || "").replace(/\D/g, "").slice(0, 11);

  return (
    <MyBookings
      slug={TENANT}
      branding={branding}
      unidades={unidades}
      profissionais={profissionais}
      servicos={servicos}
      telInicial={telInicial}
    />
  );
}
