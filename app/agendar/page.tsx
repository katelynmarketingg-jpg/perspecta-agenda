import { getBranding, getUnidades, getProfissionais, getServicos } from "@/lib/data";
import BookingWizard from "@/components/BookingWizard";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

// Catálogo vem do banco: sem prerender, senão congela no build.
export const dynamic = "force-dynamic";

// Server component: carrega tudo do tenant e entrega ao wizard (client).
export default async function AgendarPage() {
  const [branding, unidades, profissionais, servicos] = await Promise.all([
    getBranding(TENANT),
    getUnidades(TENANT),
    getProfissionais(TENANT),
    getServicos(TENANT),
  ]);
  if (!branding) return <div className="app"><div className="body">Barbearia não encontrada.</div></div>;

  return (
    <BookingWizard
      slug={TENANT}
      branding={branding}
      unidades={unidades}
      profissionais={profissionais}
      servicos={servicos}
    />
  );
}
