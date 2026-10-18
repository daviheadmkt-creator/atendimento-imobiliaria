import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { AuthConfigNotice } from "@/app/auth-config-notice";

export const instant = false;

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;

  return (
    <main>
      <h1>Recuperar acesso</h1>
      <AuthConfigNotice />
      {params.error && <p role="alert">Não foi possível enviar o link. Confira o e-mail e tente novamente.</p>}
      {params.message && <p role="status">Se a conta existir, você receberá um link para redefinir a senha.</p>}
      <form action={requestPasswordResetAction}>
        <p>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </p>
        <button type="submit">Enviar link de recuperação</button>
      </form>
      <p><Link href="/login">Voltar para entrar</Link></p>
    </main>
  );
}