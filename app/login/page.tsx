import Link from "next/link";
import { getBranding } from "@/lib/data";
import { brandingVars } from "@/lib/branding";
import LoginForm from "@/components/LoginForm";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

export default function LoginPage() {
  const branding = getBranding(TENANT);
  if (!branding) return <div className="app"><div className="body">Barbearia não encontrada.</div></div>;

  return (
    <div className="app" style={brandingVars(branding)}>
      <LoginForm branding={branding} />
      <div className="foot">
        <div className="hint">
          É o dono?{" "}
          <Link href="/config" style={{ color: "var(--brass)" }}>Personalizar a marca</Link>
        </div>
      </div>
    </div>
  );
}
