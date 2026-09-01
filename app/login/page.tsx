import { redirect } from "next/navigation";

// O login foi removido — agenda-se sem conta. Mantém a rota antiga viva
// redirecionando para a tela inicial, para não quebrar links/abas salvos.
export default function LoginRedirect() {
  redirect("/");
}
