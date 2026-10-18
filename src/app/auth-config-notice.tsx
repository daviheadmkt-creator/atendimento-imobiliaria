import { hasValidSupabasePublicEnv } from "@/lib/env";

export function AuthConfigNotice() {
  if (hasValidSupabasePublicEnv()) {
    return null;
  }

  return (
    <p role="alert">
      Supabase não está configurado. Copie <code>.env.example</code> para <code>.env.local</code>,
      preencha <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
      com os valores do projeto de desenvolvimento e reinicie o servidor.
    </p>
  );
}