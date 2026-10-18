import { redirect } from "next/navigation";
import { logoutAction } from "@/lib/auth/actions";
import { requireAuthenticatedUser } from "@/lib/auth/user";

export const instant = false;

const roleLabels: Record<string, string> = {
  owner: "Responsável",
  admin: "Administrador",
  manager: "Gerente",
  agent: "Corretor",
};

export default async function DashboardPage() {
  const { supabase, user } = await requireAuthenticatedUser();
  const { data: memberships, error: membershipsError } = await supabase
    .from("memberships")
    .select("organization_id, role, status")
    .eq("user_id", user.id);

  if (membershipsError) {
    redirect("/access-denied");
  }

  if (!memberships?.length) {
    redirect("/onboarding/organization");
  }

  const activeMemberships = memberships.filter((membership) => membership.status === "active");

  if (!activeMemberships.length) {
    redirect("/access-denied");
  }

  const { data: organizations, error: organizationsError } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", activeMemberships.map((membership) => membership.organization_id));

  if (organizationsError) {
    redirect("/access-denied");
  }

  const membershipsByOrganization = new Map(
    activeMemberships.map((membership) => [membership.organization_id, membership.role]),
  );

  return (
    <main>
      <h1>Atendimento Imobiliário</h1>
      <p>{user.email}</p>
      <h2>Empresas</h2>
      <ul>
        {organizations?.map((organization) => (
          <li key={organization.id}>
            {organization.name} · {roleLabels[membershipsByOrganization.get(organization.id) ?? ""] ?? "Membro"}
          </li>
        ))}
      </ul>
      <form action={logoutAction}>
        <button type="submit">Sair</button>
      </form>
    </main>
  );
}