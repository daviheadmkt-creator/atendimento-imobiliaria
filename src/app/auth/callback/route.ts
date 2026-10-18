import { NextResponse, type NextRequest } from "next/server";
import { hasValidSupabasePublicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }

  return value;
}

export async function GET(request: NextRequest) {
  if (!hasValidSupabasePublicEnv()) {
    return NextResponse.redirect(new URL("/login?error=configuration", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(
        new URL(safeNextPath(request.nextUrl.searchParams.get("next")), request.url),
      );
    }
  }

  return NextResponse.redirect(new URL("/login?error=callback", request.url));
}