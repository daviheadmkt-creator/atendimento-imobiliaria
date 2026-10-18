import Link from "next/link";
import { loginAction } from "@/lib/auth/actions";
import { AuthConfigNotice } from "@/app/auth-config-notice";

export const instant = false;

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

const errorMessages: Record<string, string> = {
  invalid: "Informe um e-mail válido e a senha.",
  credentials: "E-mail ou senha inválidos.",
  session: "Sua sessão expirou. Entre novamente.",
  callback: "Não foi possível validar o link. Solicite um novo.",
  configuration: "Configure a conexão com Supabase antes de entrar.",
};

const successMessages: Record<string, string> = {
  "check-email": "Confira seu e-mail para confirmar a conta antes de entrar.",
  "signed-out": "Você saiu da sua conta.",
  "password-updated": "Senha atualizada. Entre com a nova senha.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main>
      <h1>Entrar</h1>
      <AuthConfigNotice />
      {params.error && <p role="alert">{errorMessages[params.error] ?? "Não foi possível entrar."}</p>}
      {params.message && <p role="status">{successMessages[params.message] ?? ""}</p>}
      <form action={loginAction}>
        <p>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </p>
        <p>
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </p>
        <button type="submit">Entrar</button>
      </form>
      <p><Link href="/forgot-password">Esqueci minha senha</Link></p>
      <p><Link href="/signup">Criar conta</Link></p>
    </main>
  );
}