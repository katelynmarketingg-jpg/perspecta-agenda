import { redirect } from "next/navigation";

// A raiz leva direto ao login do cliente.
export default function Home() {
  redirect("/login");
}
