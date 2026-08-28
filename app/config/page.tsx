import { getBranding } from "@/lib/data";
import BrandingPanel from "@/components/BrandingPanel";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

export default function ConfigPage() {
  const branding = getBranding(TENANT);
  if (!branding) return <div className="app"><div className="body">Barbearia não encontrada.</div></div>;
  return <BrandingPanel inicial={branding} />;
}
