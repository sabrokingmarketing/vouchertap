import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useProfile } from "@/hooks/use-profile";
import { isMemberDisabled } from "@/lib/member-status";
import { toast } from "sonner";
import {
  CalendarDays,
  TicketPercent,
  BadgeCheck,
  User as UserIcon,
  Loader2,
  LayoutDashboard,
  ShoppingBag,
} from "lucide-react";
import { BrandHeart } from "@/components/brand-heart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

const TABS = [
  { to: "/app/events", label: "Events", icon: CalendarDays },
  { to: "/app/vouchers", label: "Vouchers", icon: TicketPercent },
  { to: "/app/my-vouchers", label: "Mine", icon: BadgeCheck },
  { to: "/app/shop", label: "Shop", icon: ShoppingBag },
  { to: "/app/profile", label: "Profile", icon: UserIcon },
] as const;

function AppLayout() {
  const { session, loading, user, signOut } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const profileQuery = useProfile();
  const navigate = useNavigate();
  const location = useLocation();

  // A member must complete the 2-step onboarding once before entering the
  // app. Admins are exempt (backfilled as completed by migration). A missing
  // profile row also counts as "needs onboarding" — the wizard self-heals it.
  // Strict `=== null` matters: if the onboarding migration hasn't been applied
  // to the live DB yet, the column is absent (undefined) and we must NOT gate,
  // otherwise members would be locked behind a wizard that can't save.
  const needsOnboarding =
    !!session &&
    !profileQuery.isPending &&
    !profileQuery.isError &&
    (profileQuery.data == null || profileQuery.data.onboarding_completed_at === null);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [session, loading, navigate]);

  useEffect(() => {
    if (needsOnboarding) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [needsOnboarding, navigate]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    isMemberDisabled(user.id)
      .then((disabled) => {
        if (cancelled || !disabled) return;
        toast.error("Your account has been disabled.");
        void signOut().then(() => navigate({ to: "/login" }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id, signOut, navigate]);

  if (loading || !session || (profileQuery.isPending && !profileQuery.data) || needsOnboarding) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background md:bg-muted/30 flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-72 md:min-h-dvh bg-background border-r border-border">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-md shadow-primary/20">
              <BrandHeart className="size-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-primary font-semibold leading-none">
                Members
              </p>
              <h1 className="text-base font-bold leading-tight mt-1">So Love Krugersdorp</h1>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {TABS.map((tab) => {
            const active = location.pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4" />
                {tab.label}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-3 px-3.5 py-2.5 mt-4 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-dashed border-border"
            >
              <LayoutDashboard className="size-4" />
              Admin portal
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2">
            <div className="size-9 rounded-full bg-muted grid place-items-center text-muted-foreground">
              <UserIcon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{user?.email}</p>
              <p className="text-[11px] text-muted-foreground">Active member</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      {/* Padding comes from the shared shell tokens rather than inline styles,
          which used to win over `md:` and keep the phone's bottom reserve on
          desktop too. See --app-nav-space in styles.css. */}
      <main className="flex-1 mx-auto w-full max-w-xl md:max-w-6xl px-5 md:px-10 pt-[var(--app-top-space)] md:pt-10 pb-[var(--app-nav-space)] md:pb-12">
        <Outlet />
      </main>

      {/* Installed as a PWA the status bar is translucent, so content scrolls up
          into the clock. This frosted strip is exactly the inset tall — and zero
          tall in a normal browser, where the status bar isn't ours to cover. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[var(--app-safe-top)] bg-background/85 backdrop-blur-md md:hidden"
      />

      {/* Mobile floating pill nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 px-4 pb-[var(--app-nav-inset)] pointer-events-none">
        <ul
          className={cn(
            // bg-background/95, not /80: at 80% the ticket underneath showed
            // through while scrolling, which read as the bar stuck to the card.
            "pointer-events-auto mx-auto max-w-sm grid items-center rounded-full border border-border/60 bg-background/95 backdrop-blur-xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)] px-2 py-2",
            isAdmin ? "grid-cols-6" : "grid-cols-5",
          )}
        >
          {TABS.map((tab) => {
            const active = location.pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <li key={tab.to} className="flex justify-center">
                <Link
                  to={tab.to}
                  aria-label={tab.label}
                  className={cn(
                    "grid place-items-center size-11 rounded-full transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                </Link>
              </li>
            );
          })}
          {isAdmin && (
            <li className="flex justify-center">
              <Link
                to="/admin"
                aria-label="Admin"
                className={cn(
                  "grid place-items-center size-11 rounded-full transition-colors",
                  location.pathname.startsWith("/admin")
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutDashboard className="size-5" />
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}
