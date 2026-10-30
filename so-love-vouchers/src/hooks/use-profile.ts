import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
  slk_code: string | null;
  phone: string | null;
  work_phone: string | null;
  business_name: string | null;
  business_email: string | null;
  business_website: string | null;
  business_logo_url: string | null;
  onboarding_completed_at: string | null;
  /** When the member accepted the POPIA notice; null = not yet. */
  popia_accepted_at: string | null;
  created_at: string | null;
};

/** True when a write failed because the live DB is missing a new column
 * (onboarding migration not applied yet) — callers retry with legacy fields. */
export function isMissingColumnError(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === "42703" || /column .* does not exist/i.test(err?.message ?? "");
}

/**
 * The signed-in user's own profile row. Shared query key ["profile", userId]
 * so the onboarding gate, profile page and edit dialog all read one cache.
 *
 * Selects "*" (not an explicit column list) so the query keeps working even
 * if the onboarding migration hasn't been applied to the live DB yet — new
 * columns simply come back undefined instead of erroring the whole query.
 */
export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Profile | null;
    },
    enabled: !!user?.id,
  });
}
