import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { EventRegistration } from "@/lib/event-registration";

/** The signed-in member's event registrations, keyed by event id. */
export function useMyEventRegistrations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-event-registrations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      const byEvent: Record<string, EventRegistration> = {};
      for (const r of (data ?? []) as EventRegistration[]) byEvent[r.event_id] = r;
      return byEvent;
    },
  });
}
