import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { PopiaConsentGate } from "@/components/popia-consent-gate";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CalendarDays,
  Coffee,
  Ticket,
  Receipt,
  Users,
  Phone,
  Loader2,
  ArrowLeft,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isMemberDisabled } from "@/lib/member-status";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const NAV: {
  to:
    | "/admin"
    | "/admin/events"
    | "/admin/breakfast"
    | "/admin/vouchers"
    | "/admin/shop"
    | "/admin/redemptions"
    | "/admin/members"
    | "/admin/contact";
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/events", label: "Events", icon: CalendarDays },
  { to: "/admin/breakfast", label: "Breakfast", icon: Coffee },
  { to: "/admin/vouchers", label: "Vouchers", icon: Ticket },
  { to: "/admin/shop", label: "Shop", icon: ShoppingBag },
  { to: "/admin/redemptions", label: "Redemptions", icon: Receipt },
  { to: "/admin/members", label: "Members", icon: Users },
  { to: "/admin/contact", label: "Contact", icon: Phone },
];

function AdminLayout() {
  const { session, loading, user, signOut } = useAuth();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
      return;
    }
    if (!loading && !roleLoading && session && isAdmin === false) {
      navigate({ to: "/app/vouchers" });
    }
  }, [session, loading, isAdmin, roleLoading, navigate]);

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

  if (loading || roleLoading || !session || !isAdmin) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-muted/30 flex flex-col md:flex-row">
      <aside className="md:w-60 md:min-h-dvh bg-background border-b md:border-b-0 md:border-r border-border flex md:flex-col">
        <div className="hidden md:block p-5 border-b border-border">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold">Admin</p>
          <h1 className="text-lg font-bold mt-1 leading-tight">So Love Krugersdorp</h1>
        </div>
        <nav className="flex-1 flex md:flex-col gap-1 p-2 overflow-x-auto md:overflow-x-visible">
          {NAV.map((n) => {
            const active = n.exact
              ? location.pathname === n.to
              : location.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:block p-2 border-t border-border">
          <Link
            to="/app/vouchers"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-3.5" />
            Back to app
          </Link>
        </div>
      </aside>

      <main className="flex-1 p-5 md:p-8 max-w-5xl w-full mx-auto">
        <Outlet />
        <PopiaConsentGate />
      </main>
    </div>
  );
}
