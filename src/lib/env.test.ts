import { describe, expect, it } from "vitest";
import { parseSupabasePublicEnv } from "./env";

describe("parseSupabasePublicEnv", () => {
  it("accepts a valid public Supabase configuration", () => {
    expect(
      parseSupabasePublicEnv({
        url: "http://127.0.0.1:54321",
        anonKey: "local-public-key",
      }),
    ).toEqual({
      url: "http://127.0.0.1:54321",
      anonKey: "local-public-key",
    });
  });

  it("rejects missing or invalid values with setup guidance", () => {
    expect(() =>
      parseSupabasePublicEnv({ url: "not-a-url", anonKey: undefined }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("rejects the placeholder key from the example env file", () => {
    expect(() =>
      parseSupabasePublicEnv({
        url: "http://127.0.0.1:54321",
        anonKey: "replace-with-local-anon-or-publishable-key",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});