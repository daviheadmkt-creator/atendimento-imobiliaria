import { redirect } from "next/navigation";
import { createOrganizationAction } from "@/lib/auth/actions";
import { requireAuthenticatedUser } from "@/lib/auth/user";

export const instant = false;

type OrganizationOnboardingPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function OrganizationOnboardingPage({ searchParams }: OrganizationOnboardingPageProps) {
  const { supabase, user } = await requireAuthenticatedUser();
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("status")
    .eq("user_id", user.id);

  if (error) {
    redirect("/access-denied");
  }

  if (memberships?.some((membership) => membership.status === "active")) {
    redirect("/dashboard");
  }

  if (memberships?.some((membership) => membership.status === "suspended")) {
    redirect("/access-denied");
  }

  const params = await searchParams;

  return (
    <main>
      <h1>Criar primeira empresa</h1>
      <p>A empresa e o vínculo de owner são criados juntos para sua conta autenticada.</p>
      {params.error && (
        <p role="alert">
          {params.error === "invalid"
            ? "Informe um nome com até 120 caracteres."
            : params.error === "membership"
              ? "Esta conta já possui um vínculo com uma empresa."
              : "Não foi possível criar a empresa. Tente novamente."}
        </p>
      )}
      <form action={createOrganizationAction}>
        <p>
          <label htmlFor="name">Nome da empresa</label>
          <input id="name" name="name" maxLength={120} required />
        </p>
        <button type="submit">Criar empresa</button>
      </form>
    </main>
  );
}