import { getBranding } from "@/lib/data";
import BrandingPanel from "@/components/BrandingPanel";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

// Catálogo vem do banco: sem prerender, senão congela no build.
export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const branding = await getBranding(TENANT);
  if (!branding) return <div className="app"><div className="body">Barbearia não encontrada.</div></div>;
  return <BrandingPanel inicial={branding} />;
}
