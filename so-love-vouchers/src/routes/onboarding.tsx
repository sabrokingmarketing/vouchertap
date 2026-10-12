import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useProfile, isMissingColumnError, type Profile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "@/components/image-uploader";
import { toast } from "sonner";
import { Loader2, ArrowRight, Building2, Sparkles } from "lucide-react";
import { BrandHeart } from "@/components/brand-heart";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
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

function OnboardingPage() {
  const { user, session, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — personal
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [slkCode, setSlkCode] = useState("");

  // Step 2 — business (optional)
  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [workPhone, setWorkPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Prefill once the profile arrives (existing users see their data).
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (profile && !seeded) {
      setFirstName(profile.first_name ?? "");
      setLastName(profile.last_name ?? "");
      setSlkCode(profile.slk_code ?? "");
      setBusinessName(profile.business_name ?? "");
      setBusinessEmail(profile.business_email ?? "");
      setPhone(profile.phone ?? "");
      setWorkPhone(profile.work_phone ?? "");
      setWebsite(profile.business_website ?? "");
      setLogoUrl(profile.business_logo_url ?? null);
      // Name already on file (e.g. captured at signup)? Go straight to the
      // optional business step instead of asking again.
      if (profile.first_name?.trim() && profile.last_name?.trim()) setStep(2);
      setSeeded(true);
    }
  }, [profile, seeded]);

  // Guards
  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [session, loading, navigate]);

  useEffect(() => {
    if (profile?.onboarding_completed_at) {
      navigate({ to: "/app/events", replace: true });
    }
  }, [profile?.onboarding_completed_at, navigate]);

  const savePersonal = useMutation({
    mutationFn: async () => {
      if (!firstName.trim() || !lastName.trim())
        throw new Error("Please enter your name and surname.");
      const displayName = profile?.display_name || `${firstName.trim()} ${lastName.trim()}`;
      // Upsert: self-heals the rare case where the signup trigger hasn't
      // created the profile row yet.
      const base = {
        id: user!.id,
        email: user!.email ?? profile?.email ?? null,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: displayName,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("profiles")
        .upsert({ ...base, slk_code: slkCode.trim() || null }, { onConflict: "id" });
      if (error) {
        // Live DB missing the onboarding migration — save what we can.
        if (!isMissingColumnError(error)) throw error;
        const retry = await supabase.from("profiles").upsert(base, { onConflict: "id" });
        if (retry.error) throw retry.error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      setStep(2);
    },
    onError: (e) => toast.error(e.message || "Could not save. Please try again."),
  });

  /** Finish onboarding. `saveBusiness = false` is "Skip for now". */
  const finish = useMutation({
    mutationFn: async (saveBusiness: boolean) => {
      const completedAt = new Date().toISOString();
      // Upsert (not update): a missing profile row would make an update
      // silently match 0 rows and bounce the member straight back here.
      const legacy = {
        id: user!.id,
        email: user!.email ?? profile?.email ?? null,
        updated_at: completedAt,
        ...(saveBusiness && {
          business_name: businessName.trim() || null,
          phone: phone.trim() || null,
          business_website: website.trim() || null,
          business_logo_url: logoUrl,
        }),
      };
      const full = {
        ...legacy,
        onboarding_completed_at: completedAt,
        ...(saveBusiness && {
          business_email: businessEmail.trim() || null,
          work_phone: workPhone.trim() || null,
        }),
      };
      const { error } = await supabase.from("profiles").upsert(full, { onConflict: "id" });
      if (error) {
        // Live DB missing the onboarding migration — save the legacy fields
        // and let the user through.
        if (!isMissingColumnError(error)) throw error;
        const retry = await supabase.from("profiles").upsert(legacy, { onConflict: "id" });
        if (retry.error) throw retry.error;
      }
      return completedAt;
    },
    onSuccess: (completedAt) => {
      // Update the cache before navigating so the app gate sees "completed"
      // synchronously and never bounces back here.
      // Seed even when the cached profile is missing, so the gate never
      // bounces the member back here.
      qc.setQueryData(["profile", user?.id], (prev: Profile | null | undefined) => ({
        ...(prev ?? ({ id: user!.id } as Profile)),
        onboarding_completed_at: completedAt,
      }));
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Welcome to So Love Krugersdorp!");
      navigate({ to: "/app/events", replace: true });
    },
    onError: (e) => toast.error(e.message || "Could not save. Please try again."),
  });

  if (loading || !session || profileLoading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
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
            {step === 1 ? "Welcome to So Love" : "Almost there"}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-2 tracking-tight">
            {step === 1 ? "Tell us about you" : "Your business"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
            {step === 1
              ? "A few quick details to set up your membership."
              : "Optional — add your company so the community can find you."}
          </p>
          <div className="mt-5">
            <StepDots step={step} />
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border/70 bg-card shadow-lg shadow-black/[0.04] ring-1 ring-black/[0.02] p-6 md:p-7">
          {step === 1 ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                savePersonal.mutate();
              }}
            >
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
              <FieldBlock label="SLK code" hint="Optional — your member code, if you have one.">
                <Input
                  className="font-serial uppercase"
                  placeholder="e.g. SLK-1234"
                  value={slkCode}
                  onChange={(e) => setSlkCode(e.target.value)}
                />
              </FieldBlock>
              <Button
                type="submit"
                size="lg"
                className="w-full h-12 rounded-xl font-semibold mt-2"
                disabled={savePersonal.isPending}
              >
                {savePersonal.isPending ? (
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
                finish.mutate(true);
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
                  autoComplete="email"
                  placeholder="hello@company.co.za"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                />
              </FieldBlock>
              <div className="grid grid-cols-2 gap-3">
                <FieldBlock label="Personal tel">
                  <Input
                    type="tel"
                    autoComplete="tel"
                    placeholder="082 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </FieldBlock>
                <FieldBlock label="Work tel">
                  <Input
                    type="tel"
                    placeholder="011 000 0000"
                    value={workPhone}
                    onChange={(e) => setWorkPhone(e.target.value)}
                  />
                </FieldBlock>
              </div>
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
                  disabled={finish.isPending}
                >
                  {finish.isPending ? (
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
                  disabled={finish.isPending}
                  onClick={() => finish.mutate(false)}
                >
                  Skip for now
                </Button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          You can update any of this later in your profile.
        </p>
      </div>
    </main>
  );
}
