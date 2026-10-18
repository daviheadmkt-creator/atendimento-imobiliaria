import Link from "next/link";
import { updatePasswordAction } from "@/lib/auth/actions";
import { AuthConfigNotice } from "@/app/auth-config-notice";

export const instant = false;

type ResetPasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;

  return (
    <main>
      <h1>Definir nova senha</h1>
      <AuthConfigNotice />
      {params.error && (
        <p role="alert">
          {params.error === "invalid"
            ? "A senha deve ter ao menos 12 caracteres."
            : "O link expirou ou não é válido. Solicite outro link de recuperação."}
        </p>
      )}
      <form action={updatePasswordAction}>
        <p>
          <label htmlFor="password">Nova senha</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
        </p>
        <button type="submit">Atualizar senha</button>
      </form>
      <p><Link href="/login">Voltar para entrar</Link></p>
    </main>
  );
}