import { getBranding } from "@/lib/data";
import StartScreen from "@/components/StartScreen";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

// Tela inicial (sem login): agendar ou consultar por telefone.
export default function Home() {
  const branding = getBranding(TENANT);
  if (!branding) return <div className="app"><div className="body">Barbearia não encontrada.</div></div>;
  return <StartScreen branding={branding} />;
}
