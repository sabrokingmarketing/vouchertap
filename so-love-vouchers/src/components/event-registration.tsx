import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Mail, User as UserIcon, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ATTENDEE_PRESETS,
  MAX_ATTENDEES,
  type EventRegistration,
  attendeesLabel,
} from "@/lib/event-registration";

type EventLike = { id: string; title: string };

const CUSTOM = "custom";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120, "Name is too long"),
  email: z.string().trim().email("Enter a valid email"),
  attendees: z
    .number({ invalid_type_error: "Enter how many will attend" })
    .int("Use a whole number")
    .min(1, "At least 1 person")
    .max(MAX_ATTENDEES, `At most ${MAX_ATTENDEES} people`),
});

/**
 * The in-app registration call-to-action for an event card: a Register
 * button, or — once registered — a confirmation with an Edit button.
 */
export function InAppRegistration({
  event,
  registration,
}: {
  event: EventLike;
  registration?: EventRegistration;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {registration ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-600/20 bg-emerald-500/[0.07] pl-3.5 pr-1.5 py-1.5">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <p className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
            You're registered · {attendeesLabel(registration.attendees)}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 rounded-lg shrink-0"
            onClick={() => setOpen(true)}
          >
            Edit
          </Button>
        </div>
      ) : (
        <Button className="w-full rounded-xl h-12 font-semibold" onClick={() => setOpen(true)}>
          Register
        </Button>
      )}
      <RegisterDialog
        open={open}
        onOpenChange={setOpen}
        event={event}
        registration={registration}
      />
    </>
  );
}

function RegisterDialog({
  open,
  onOpenChange,
  event,
  registration,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event: EventLike;
  registration?: EventRegistration;
}) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [choice, setChoice] = useState<string>("1");
  const [custom, setCustom] = useState("");

  // (Re)seed every time it opens: their existing registration when editing,
  // otherwise prefilled from their profile.
  useEffect(() => {
    if (!open) return;
    if (registration) {
      setName(registration.name);
      setEmail(registration.email);
      const preset = (ATTENDEE_PRESETS as readonly number[]).includes(registration.attendees);
      setChoice(preset ? String(registration.attendees) : CUSTOM);
      setCustom(preset ? "" : String(registration.attendees));
    } else {
      const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
      setName(fullName || profile?.display_name || "");
      setEmail(user?.email ?? profile?.email ?? "");
      setChoice("1");
      setCustom("");
    }
  }, [open, registration, profile, user?.email]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-event-registrations", user?.id] });

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({
        name,
        email,
        attendees: choice === CUSTOM ? Number(custom) : Number(choice),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const { error } = await supabase.from("event_registrations").upsert(
        {
          event_id: event.id,
          user_id: user!.id,
          name: parsed.data.name,
          email: parsed.data.email,
          attendees: parsed.data.attendees,
        },
        { onConflict: "event_id,user_id" },
      );
      if (error) throw error;
      return parsed.data.attendees;
    },
    onSuccess: (n) => {
      toast.success(
        registration
          ? "Registration updated"
          : `You're registered for ${event.title} · ${attendeesLabel(n)}`,
      );
      invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message || "Could not register. Please try again."),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("event_registrations")
        .delete()
        .eq("event_id", event.id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registration cancelled");
      invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message || "Could not cancel. Please try again."),
  });

  const busy = submit.isPending || cancel.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md rounded-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 text-left">
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">
            {registration ? "Your registration" : "Register"}
          </p>
          <DialogTitle className="text-xl tracking-tight">{event.title}</DialogTitle>
          <DialogDescription>
            {registration
              ? "Update your details or the number attending."
              : "Let us know you're coming."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="px-6 pb-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="reg-name">Name</Label>
            <div className="relative">
              <UserIcon className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                id="reg-name"
                autoComplete="name"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-email">Email</Label>
            <div className="relative">
              <Mail className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-attendees">How many of you will attend?</Label>
            <div className="relative">
              <Users className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              {/* Native select: gives members the phone's own picker wheel. */}
              <select
                id="reg-attendees"
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-9 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {ATTENDEE_PRESETS.map((n) => (
                  <option key={n} value={String(n)}>
                    {n === 1 ? "Just me (1)" : `${n} people`}
                  </option>
                ))}
                <option value={CUSTOM}>Custom number…</option>
              </select>
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="size-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="currentColor"
              >
                <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
              </svg>
            </div>
            {choice === CUSTOM && (
              <Input
                id="reg-custom"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_ATTENDEES}
                step={1}
                autoFocus
                placeholder="Enter number of people"
                aria-label="Custom number of people attending"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="h-11 tabular-nums mt-2"
              />
            )}
          </div>

          <Button type="submit" className="w-full h-12 rounded-xl font-semibold" disabled={busy}>
            {submit.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : registration ? (
              "Save changes"
            ) : (
              "Confirm registration"
            )}
          </Button>
          {registration && (
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground hover:text-destructive"
              disabled={busy}
              onClick={() => cancel.mutate()}
            >
              {cancel.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Cancel registration"
              )}
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
