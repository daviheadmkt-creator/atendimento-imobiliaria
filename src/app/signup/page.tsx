import Link from "next/link";
import { signupAction } from "@/lib/auth/actions";
import { AuthConfigNotice } from "@/app/auth-config-notice";

export const instant = false;

type SignupPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;

  return (
    <main>
      <h1>Criar conta</h1>
      <AuthConfigNotice />
      {params.error && (
        <p role="alert">
          {params.error === "invalid"
            ? "Confira o nome, e-mail e senha. A senha deve ter ao menos 12 caracteres."
            : params.error === "configuration"
              ? "Configure o Supabase antes de criar a conta."
              : "Não foi possível criar a conta. Verifique os dados ou tente mais tarde."}
        </p>
      )}
      <form action={signupAction}>
        <p>
          <label htmlFor="full_name">Nome</label>
          <input id="full_name" name="full_name" autoComplete="name" maxLength={120} required />
        </p>
        <p>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </p>
        <p>
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
        </p>
        <button type="submit">Criar conta</button>
      </form>
      <p><Link href="/login">Já tenho uma conta</Link></p>
    </main>
  );
}