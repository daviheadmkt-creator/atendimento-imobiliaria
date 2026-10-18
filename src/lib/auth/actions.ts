"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSiteUrl, hasValidSupabasePublicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().email();
const passwordSchema = z.string().min(12).max(128);

function readFormValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function getAuthCallbackUrl(next: string) {
  const url = new URL("/auth/callback", getSiteUrl());
  url.searchParams.set("next", next);
  return url.toString();
}

function requireSupabaseConfiguration(path: string) {
  if (!hasValidSupabasePublicEnv()) {
    redirect(`${path}?error=configuration`);
  }
}

export async function loginAction(formData: FormData) {
  requireSupabaseConfiguration("/login");
  const email = emailSchema.safeParse(readFormValue(formData, "email"));
  const password = z.string().min(1).safeParse(readFormValue(formData, "password"));

  if (!email.success || !password.success) {
    redirect("/login?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });

  if (error) {
    redirect("/login?error=credentials");
  }

  redirect("/dashboard");
}

export async function signupAction(formData: FormData) {
  requireSupabaseConfiguration("/signup");
  const fullName = z.string().trim().min(1).max(120).safeParse(readFormValue(formData, "full_name"));
  const email = emailSchema.safeParse(readFormValue(formData, "email"));
  const password = passwordSchema.safeParse(readFormValue(formData, "password"));

  if (!fullName.success || !email.success || !password.success) {
    redirect("/signup?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.data,
    password: password.data,
    options: {
      data: { full_name: fullName.data },
      emailRedirectTo: getAuthCallbackUrl("/onboarding/organization"),
    },
  });

  if (error) {
    redirect("/signup?error=signup");
  }

  if (data.session) {
    redirect("/onboarding/organization");
  }

  redirect("/login?message=check-email");
}

export async function logoutAction() {
  requireSupabaseConfiguration("/login");
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login?message=signed-out");
}

export async function requestPasswordResetAction(formData: FormData) {
  requireSupabaseConfiguration("/forgot-password");
  const email = emailSchema.safeParse(readFormValue(formData, "email"));

  if (!email.success) {
    redirect("/forgot-password?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: getAuthCallbackUrl("/reset-password"),
  });

  if (error) {
    redirect("/forgot-password?error=send");
  }

  redirect("/forgot-password?message=sent");
}

export async function updatePasswordAction(formData: FormData) {
  requireSupabaseConfiguration("/reset-password");
  const password = passwordSchema.safeParse(readFormValue(formData, "password"));

  if (!password.success) {
    redirect("/reset-password?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?error=session");
  }

  const { error } = await supabase.auth.updateUser({ password: password.data });

  if (error) {
    redirect("/reset-password?error=update");
  }

  redirect("/login?message=password-updated");
}

export async function createOrganizationAction(formData: FormData) {
  requireSupabaseConfiguration("/login");
  const name = z.string().trim().min(1).max(120).safeParse(readFormValue(formData, "name"));

  if (!name.success) {
    redirect("/onboarding/organization?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?error=session");
  }

  const { error } = await supabase.rpc("create_organization", { p_name: name.data });

  if (error) {
    redirect(
      error.code === "42501"
        ? "/onboarding/organization?error=membership"
        : "/onboarding/organization?error=create",
    );
  }

  redirect("/dashboard");
}