import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv, hasValidSupabasePublicEnv } from "@/lib/env";

export async function proxy(request: NextRequest) {
  if (!hasValidSupabasePublicEnv()) {
    return NextResponse.redirect(new URL("/login?error=configuration", request.url));
  }

  const { url, anonKey } = getSupabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims.sub) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*"],
};