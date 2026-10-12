import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BrandHeart } from "@/components/brand-heart";
import { BellRing, Check, Compass, MoreVertical, Plus, Share, Zap } from "lucide-react";
import {
  INSTALLED_EVENT,
  INSTALL_AVAILABLE_EVENT,
  canPromptInstall,
  iosNeedsSafari,
  isIOSDevice,
  isStandalone,
  markInstallPageSeen,
  promptInstall,
} from "@/lib/pwa-install";

export const Route = createFileRoute("/install")({
  component: InstallPage,
});

const PERKS = [
  { icon: Zap, text: "Opens straight to your vouchers — no typing the address" },
  { icon: BellRing, text: "Get a nudge when a new voucher drops" },
  { icon: Compass, text: "Runs full screen, like a normal app" },
];

function InstallPage() {
  const navigate = useNavigate();
  const onward = () => navigate({ to: "/app/events", replace: true });

  // Everything below depends on the browser, so nothing renders until mount.
  const [ready, setReady] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already installed — there is nothing to offer.
    if (isStandalone()) {
      onward();
      return;
    }
    // Seen once is enough: the entry route stops routing here after this.
    markInstallPageSeen();
    setCanPrompt(canPromptInstall());
    setReady(true);

    const onAvailable = () => setCanPrompt(true);
    const onInstalled = () => {
      setInstalled(true);
      setCanPrompt(false);
    };
    window.addEventListener(INSTALL_AVAILABLE_EVENT, onAvailable);
    window.addEventListener(INSTALLED_EVENT, onInstalled);
    return () => {
      window.removeEventListener(INSTALL_AVAILABLE_EVENT, onAvailable);
      window.removeEventListener(INSTALLED_EVENT, onInstalled);
    };
    // onward is stable enough for a mount-only effect; navigate never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleInstall() {
    setBusy(true);
    const outcome = await promptInstall();
    setBusy(false);
    if (outcome === "accepted") setInstalled(true);
    // "dismissed" spends the event, so fall back to the written steps.
    if (outcome !== "accepted") {
      setCanPrompt(false);
      setDismissed(true);
    }
  }

  if (!ready) return null;

  const ios = isIOSDevice();

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <BrandHeart className="size-8" />
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            {installed ? "All set" : "Welcome"}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            {installed ? "Added to your home screen" : "Add So Love to your home screen"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {installed
              ? "Close this tab and open So Love from your home screen from now on."
              : "Keep your vouchers one tap away. It takes a second and uses no storage worth mentioning."}
          </p>
        </div>

        {installed ? (
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium">
              <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
              Installed
            </div>
            <Button size="lg" className="w-full" onClick={onward}>
              Continue
            </Button>
          </div>
        ) : (
          <>
            <ul className="mt-8 space-y-3">
              {PERKS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="text-muted-foreground">{text}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              {canPrompt ? (
                <Button size="lg" className="w-full" onClick={handleInstall} disabled={busy}>
                  <Plus className="size-4" />
                  Add to home screen
                </Button>
              ) : ios ? (
                <IOSSteps needsSafari={iosNeedsSafari()} />
              ) : (
                <MenuSteps dismissed={dismissed} />
              )}
            </div>

            <button
              type="button"
              onClick={onward}
              className="mt-6 w-full text-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Not now — continue in the browser
            </button>
          </>
        )}
      </div>
    </main>
  );
}

/** iOS has no install API: Safari's Share sheet is the only route in. */
function IOSSteps({ needsSafari }: { needsSafari: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {needsSafari && (
        <p className="mb-4 rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
          Open this page in Safari first — only Safari can add apps to the iPhone home screen.
        </p>
      )}
      <ol className="space-y-3 text-sm">
        <Step n={1}>
          {/* Explicit {" "} — JSX drops the whitespace around an inline element,
              which would leave screen readers reading "buttonat". */}
          Tap the Share button{" "}
          <Share aria-hidden="true" className="mx-0.5 inline size-4 -translate-y-px" /> at the
          bottom of Safari
        </Step>
        <Step n={2}>
          Scroll down and tap <strong className="font-semibold">Add to Home Screen</strong>
        </Step>
        <Step n={3}>
          Tap <strong className="font-semibold">Add</strong> in the top corner
        </Step>
      </ol>
    </div>
  );
}

/** Desktop, or a Chromium build that never offered us a prompt. */
function MenuSteps({ dismissed }: { dismissed: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {dismissed && (
        <p className="mb-4 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          No problem — you can still add it from the browser menu whenever you like.
        </p>
      )}
      <ol className="space-y-3 text-sm">
        <Step n={1}>
          Open the browser menu{" "}
          <MoreVertical aria-hidden="true" className="mx-0.5 inline size-4 -translate-y-px" />
        </Step>
        <Step n={2}>
          Choose <strong className="font-semibold">Install app</strong> or{" "}
          <strong className="font-semibold">Add to Home screen</strong>
        </Step>
        <Step n={3}>Confirm, and So Love lands with your other apps</Step>
      </ol>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-foreground/[0.06] font-serial text-[11px] font-semibold tabular-nums">
        {n}
      </span>
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}
