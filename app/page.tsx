import { getBranding } from "@/lib/data";
import StartScreen from "@/components/StartScreen";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

// Catálogo vem do banco: sem prerender, senão congela no build.
export const dynamic = "force-dynamic";

// Tela inicial (sem login): agendar ou consultar por telefone.
export default async function Home() {
  const branding = await getBranding(TENANT);
  if (!branding) return <div className="app"><div className="body">Barbearia não encontrada.</div></div>;
  return <StartScreen branding={branding} />;
}
