import { logoutAction } from "@/lib/auth/actions";

export default function AccessDeniedPage() {
  return (
    <main>
      <h1>Acesso indisponível</h1>
      <p>Esta conta não possui um vínculo ativo com uma empresa. Fale com o responsável pela organização.</p>
      <form action={logoutAction}>
        <button type="submit">Sair</button>
      </form>
    </main>
  );
}