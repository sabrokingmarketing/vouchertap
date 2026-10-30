import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useProfile, type Profile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const POINTS = [
  "Your details are used only to run your So Love membership.",
  "We never sell your information or use it for anything else.",
  "It's stored securely and protected against unauthorised access.",
];

/**
 * POPIA consent, asked once per member. Blocks the app until accepted, so
 * existing members see it on their next visit and new members right after
 * signing up (signup records it up front, so they aren't asked twice).
 *
 * Shown only when popia_accepted_at is strictly null: if the column were ever
 * missing from the database it comes back undefined, and nobody gets locked
 * out behind a notice that can't be saved.
 */
export function PopiaConsentGate() {
  const { user, signOut } = useAuth();
  const { data: profile, isPending, isError } = useProfile();
  const qc = useQueryClient();
  const [checked, setChecked] = useState(false);

  const needsConsent =
    !!user && !isPending && !isError && profile != null && profile.popia_accepted_at === null;

  const accept = useMutation({
    mutationFn: async () => {
      const acceptedAt = new Date().toISOString();
      const { data, error } = await supabase
        .from("profiles")
        .update({ popia_accepted_at: acceptedAt })
        .eq("id", user!.id)
        .select("id");
      if (error) throw error;
      // A silent 0-row update would close the notice only for it to reappear.
      if (!data?.length) throw new Error("Could not save your consent. Please try again.");
      return acceptedAt;
    },
    onSuccess: (acceptedAt) => {
      qc.setQueryData(["profile", user?.id], (prev: Profile | null | undefined) =>
        prev ? { ...prev, popia_accepted_at: acceptedAt } : prev,
      );
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e) => toast.error(e.message || "Could not save. Please try again."),
  });

  if (!needsConsent) return null;

  return (
    <Dialog open>
      <DialogContent
        hideClose
        // Consent can't be skipped by tapping outside or pressing Escape.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-md gap-0 overflow-y-auto overscroll-contain rounded-3xl p-0"
      >
        <DialogHeader className="items-center px-5 pb-2 pt-6 text-center sm:px-6 sm:pt-7 sm:text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary sm:mb-4 sm:size-14">
            <ShieldCheck className="size-6 sm:size-7" />
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            POPIA notice
          </p>
          <DialogTitle className="mt-1 text-2xl tracking-tight">
            Your privacy is protected
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed">
            So Love Krugersdorp protects all your private information in line with the Protection of
            Personal Information Act (POPIA).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 pb-6 pt-3 sm:space-y-5 sm:px-6 sm:pt-4">
          <ul className="space-y-2.5 rounded-2xl bg-muted/50 p-4">
            {POINTS.map((text) => (
              <li key={text} className="flex gap-2.5 text-[13px] leading-relaxed">
                <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>

          <label
            htmlFor="popia-accept"
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/[0.04]"
          >
            <Checkbox
              id="popia-accept"
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm leading-relaxed">
              I understand that my private information is protected under the POPIA Act, and I agree
              to So Love Krugersdorp keeping it to run my membership.
            </span>
          </label>

          <Button
            size="lg"
            className="h-12 w-full rounded-xl font-semibold"
            disabled={!checked || accept.isPending}
            onClick={() => accept.mutate()}
          >
            {accept.isPending ? <Loader2 className="size-4 animate-spin" /> : "Accept & continue"}
          </Button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full text-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Not now — sign out
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
