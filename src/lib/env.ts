import { z } from "zod";

const supabasePublicEnvSchema = z.object({
  url: z.string().url(),
  anonKey: z.string().min(1).refine((value) => !value.startsWith("replace-with-"), {
    message: "replace the example placeholder with a public Supabase key",
  }),
});

type SupabasePublicEnvInput = {
  url: string | undefined;
  anonKey: string | undefined;
};

export function parseSupabasePublicEnv(input: SupabasePublicEnvInput) {
  const result = supabasePublicEnvSchema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(
      `Invalid Supabase public configuration (${details}). Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.`,
    );
  }

  return result.data;
}

export function getSupabasePublicEnv() {
  return parseSupabasePublicEnv(getSupabasePublicEnvInput());
}

function getSupabasePublicEnvInput(): SupabasePublicEnvInput {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function hasValidSupabasePublicEnv() {
  return supabasePublicEnvSchema.safeParse(getSupabasePublicEnvInput()).success;
}

export function getSiteUrl() {
  const result = z.string().url().safeParse(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  );

  if (!result.success) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid absolute URL.");
  }

  return result.data;
}