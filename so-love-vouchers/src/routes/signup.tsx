import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "@/components/image-uploader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { isMissingColumnError, type Profile } from "@/hooks/use-profile";
import { toast } from "sonner";
import { Loader2, ArrowRight, Building2, Sparkles } from "lucide-react";
import { BrandHeart } from "@/components/brand-heart";

const step1Schema = z.object({
  firstName: z.string().trim().min(1, "Enter your name"),
  lastName: z.string().trim().min(1, "Enter your surname"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().min(6, "Enter your phone number"),
  password: z.string().min(6, "Password: at least 6 characters"),
});

// Step 2 is optional: every field may be left blank, but anything filled in
// must still be valid.
const step2Schema = z.object({
  businessName: z.string().trim(),
  businessEmail: z
    .string()
    .trim()
    .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid business email"),
  workPhone: z
    .string()
    .trim()
    .refine((v) => !v || v.length >= 6, "Enter a valid business phone number"),
  website: z.string().trim(),
});

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`Step ${step} of 2`}>
      {[1, 2].map((s) => (
        <span
          key={s}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            s === step ? "w-8 bg-primary" : "w-2 bg-border"
          }`}
        />
      ))}
    </div>
  );
}

function FieldBlock({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-primary"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SignupPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session, loading, user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  // The new account's id, taken straight from signUp(). The auth context can
  // lag a tick behind, and step 2 (including "Skip") must never depend on it.
  const [newUserId, setNewUserId] = useState<string | null>(null);
  // True once the user begins creating an account here, so the
  // "already signed in → go to app" redirect doesn't yank them out of step 2.
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — personal
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 — business (optional)
  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [workPhone, setWorkPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session && !started) navigate({ to: "/app/events" });
  }, [session, loading, started, navigate]);

  async function submitStep1(e: React.FormEvent) {
    e.preventDefault();
    const parsed = step1Schema.safeParse({
      firstName,
      lastName,
      email,
      phone,
      password,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setStarted(true);
    setSubmitting(true);
    const redirectUrl = `${window.location.origin}/app/events`;
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: redirectUrl },
    });
    if (error) {
      setSubmitting(false);
      setStarted(false);
      toast.error(error.message);
      return;
    }
    const newUserId = data.session?.user.id ?? data.user?.id;
    if (data.session && newUserId) {
      // Save the personal details right away (upsert self-heals the signup
      // trigger race). Tolerate a live DB that lacks the newest columns.
      const base = {
        id: newUserId,
        email: parsed.data.email,
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        phone: parsed.data.phone,
        display_name: `${parsed.data.firstName} ${parsed.data.lastName}`,
        updated_at: new Date().toISOString(),
      };
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(base, { onConflict: "id" });
      if (profileError && !isMissingColumnError(profileError)) {
        console.error("[signup] profile save failed:", profileError.message);
      }
      setNewUserId(newUserId);
      setSubmitting(false);
      setStep(2);
      return;
    }
    // Email confirmation flow: no session yet — the onboarding gate will
    // collect the rest after they confirm and sign in.
    setSubmitting(false);
    toast.success("Account created — check your email to confirm, then sign in.");
    navigate({ to: "/login" });
  }

  /** Finish signup. `saveBusiness = false` is "Skip for now". */
  async function finish(saveBusiness: boolean) {
    const uid = newUserId ?? user?.id;
    if (!uid) {
      toast.error("Your session has expired — please sign in to continue.");
      navigate({ to: "/login" });
      return;
    }
    let business: z.infer<typeof step2Schema> | null = null;
    if (saveBusiness) {
      const parsed = step2Schema.safeParse({ businessName, businessEmail, workPhone, website });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0].message);
        return;
      }
      business = parsed.data;
    }
    setSubmitting(true);
    const completedAt = new Date().toISOString();
    // Upsert (not update): if the profile row is somehow missing, an update
    // would silently match 0 rows and the app gate would bounce the member
    // back to onboarding.
    const legacy = {
      id: uid,
      email: email.trim() || null,
      updated_at: completedAt,
      ...(business && {
        business_name: business.businessName || null,
        business_website: business.website || null,
        business_logo_url: logoUrl,
      }),
    };
    const full = {
      ...legacy,
      onboarding_completed_at: completedAt,
      ...(business && {
        business_email: business.businessEmail || null,
        work_phone: business.workPhone || null,
      }),
    };
    const { error } = await supabase.from("profiles").upsert(full, { onConflict: "id" });
    if (error) {
      const retry = isMissingColumnError(error)
        ? await supabase.from("profiles").upsert(legacy, { onConflict: "id" })
        : { error };
      if (retry.error) {
        setSubmitting(false);
        toast.error(retry.error.message || "Could not save. Please try again.");
        return;
      }
    }
    // Mark onboarding done in the cache before navigating, so the app gate
    // sees "completed" immediately and never bounces back to the wizard.
    qc.setQueryData(["profile", uid], (prev: Profile | null | undefined) => ({
      ...(prev ?? ({ id: uid } as Profile)),
      onboarding_completed_at: completedAt,
    }));
    qc.invalidateQueries({ queryKey: ["profile", uid] });
    setSubmitting(false);
    toast.success("Welcome to So Love Krugersdorp!");
    navigate({ to: "/app/events", replace: true });
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md">
        {/* Brand mark */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="size-14 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/25 mb-5">
            {step === 1 ? <BrandHeart className="size-7" /> : <Building2 className="size-7" />}
          </div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">
            {step === 1 ? "Join So Love" : "Almost there"}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-2 tracking-tight">
            {step === 1 ? "Create your account" : "Your business"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
            {step === 1
              ? "Your details."
              : "Optional — add your company so the community can find you."}
          </p>
          <div className="mt-5">
            <StepDots step={step} />
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border/70 bg-card shadow-lg shadow-black/[0.04] ring-1 ring-black/[0.02] p-6 md:p-7">
          {step === 1 ? (
            <form className="space-y-4" onSubmit={submitStep1}>
              <div className="grid grid-cols-2 gap-3">
                <FieldBlock label="Name" required>
                  <Input
                    autoComplete="given-name"
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </FieldBlock>
                <FieldBlock label="Surname" required>
                  <Input
                    autoComplete="family-name"
                    placeholder="Dlamini"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </FieldBlock>
              </div>
              <FieldBlock label="Email" required>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FieldBlock>
              <FieldBlock label="Phone" required>
                <Input
                  type="tel"
                  autoComplete="tel"
                  placeholder="082 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="tabular-nums"
                />
              </FieldBlock>
              <FieldBlock label="Password" required>
                <PasswordInput
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </FieldBlock>
              <Button
                type="submit"
                size="lg"
                className="w-full h-12 rounded-xl font-semibold mt-2"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Continue <ArrowRight className="size-4 ml-1.5" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                finish(true);
              }}
            >
              <div className="flex justify-center pb-1">
                <ImageUploader
                  value={logoUrl}
                  onChange={setLogoUrl}
                  folder={`avatars/${user?.id}`}
                  shape="circle"
                  label="Company logo"
                />
              </div>
              <FieldBlock label="Company name">
                <Input
                  autoComplete="organization"
                  placeholder="e.g. Bella Vista Cafe"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </FieldBlock>
              <FieldBlock label="Business email">
                <Input
                  type="email"
                  placeholder="hello@company.co.za"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                />
              </FieldBlock>
              <FieldBlock label="Business phone">
                <Input
                  type="tel"
                  placeholder="011 000 0000"
                  value={workPhone}
                  onChange={(e) => setWorkPhone(e.target.value)}
                  className="tabular-nums"
                />
              </FieldBlock>
              <FieldBlock label="Website">
                <Input
                  type="url"
                  autoComplete="url"
                  placeholder="www.company.co.za"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </FieldBlock>
              <div className="space-y-2 pt-1">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-12 rounded-xl font-semibold"
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="size-4 mr-1.5" /> Finish &amp; join
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  disabled={submitting}
                  onClick={() => finish(false)}
                >
                  Skip for now
                </Button>
              </div>
            </form>
          )}
        </div>

        {step === 1 && (
          <p className="text-sm text-muted-foreground text-center mt-6">
            Already a member?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        )}
        {step === 2 && (
          <p className="text-center text-[11px] text-muted-foreground mt-6">
            You can update any of this later in your profile.
          </p>
        )}
      </div>
    </main>
  );
}
