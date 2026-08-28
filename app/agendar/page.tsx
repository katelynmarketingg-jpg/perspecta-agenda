import { getBranding, getUnidades, getProfissionais, getServicos } from "@/lib/data";
import BookingWizard from "@/components/BookingWizard";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

// Server component: carrega tudo do tenant e entrega ao wizard (client).
export default function AgendarPage() {
  const branding = getBranding(TENANT);
  if (!branding) return <div className="app"><div className="body">Barbearia não encontrada.</div></div>;

  return (
    <BookingWizard
      slug={TENANT}
      branding={branding}
      unidades={getUnidades(TENANT)}
      profissionais={getProfissionais(TENANT)}
      servicos={getServicos(TENANT)}
    />
  );
}
