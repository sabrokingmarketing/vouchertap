import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/smart-image";
import { Perforation, TicketBlock, TicketSkeleton, serialOf } from "@/components/voucher-kit";
import {
  TicketPercent,
  Loader2,
  UserRound,
  CheckCircle2,
  Clock,
  Store,
  ChevronDown,
  FileText,
  Repeat,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";

export const Route = createFileRoute("/app/vouchers")({
  component: VouchersPage,
});

type Voucher = {
  id: string;
  title: string;
  description: string | null;
  value_text: string | null;
  image_url: string | null;
  business_name: string | null;
  business_logo_url: string | null;
  claim_window_hours: number;
  terms: string | null;
  is_recurring: boolean;
};

function VouchersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  useRealtimeInvalidate("vouchers", [["vouchers", user?.id]]);
  const [confirming, setConfirming] = useState<null | {
    id: string;
    title: string;
    hours: number;
    terms: string | null;
    recurring?: boolean;
  }>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["vouchers", user?.id],
    queryFn: async () => {
      const [vouchersRes, claimsRes] = await Promise.all([
        supabase
          .from("vouchers")
          .select(
            "id, title, description, value_text, image_url, business_name, business_logo_url, claim_window_hours, terms, is_recurring",
          )
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase.from("voucher_claims").select("voucher_id, cycle_key").eq("user_id", user!.id),
      ]);
      if (vouchersRes.error) throw vouchersRes.error;
      if (claimsRes.error) throw claimsRes.error;
      // Recurring vouchers re-open every calendar month: only this month's
      // claim hides them. Normal vouchers stay hidden after any claim.
      const now = new Date();
      const thisCycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const claimedOnce = new Set(
        claimsRes.data.filter((c) => c.cycle_key === "once").map((c) => c.voucher_id),
      );
      const claimedThisMonth = new Set(
        claimsRes.data.filter((c) => c.cycle_key === thisCycle).map((c) => c.voucher_id),
      );
      return (vouchersRes.data as Voucher[]).filter((v) =>
        v.is_recurring ? !claimedThisMonth.has(v.id) : !claimedOnce.has(v.id),
      );
    },
    enabled: !!user?.id,
  });

  const claim = useMutation({
    mutationFn: async (voucherId: string) => {
      const { data, error } = await supabase.rpc("claim_voucher", {
        _voucher_id: voucherId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (claim) => {
      toast.success("Voucher claimed!");
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      qc.invalidateQueries({ queryKey: ["my-vouchers"] });
      setConfirming(null);
      navigate({ to: "/app/voucher/$id", params: { id: (claim as { id: string }).id } });
    },
    onError: (e) => {
      const msg = e.message ?? "Could not claim";
      if (
        msg.includes("voucher_claims_voucher_user_cycle_key") ||
        msg.includes("voucher_claims_voucher_id_user_id_key") ||
        msg.includes("already claimed")
      ) {
        toast.error(
          "You've already claimed this voucher for now - recurring vouchers re-open next month.",
        );
      } else if (msg.includes("voucher_not_available")) {
        toast.error("This voucher is no longer available.");
      } else if (msg.includes("voucher_expired")) {
        toast.error("This voucher has expired and can no longer be claimed.");
      } else {
        toast.error("Could not claim voucher. Please try again.");
      }
      setConfirming(null);
    },
  });

  return (
    <div className="space-y-7">
      <PageHeader count={data?.length ?? 0} loading={isLoading} />

      {isLoading ? (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <TicketSkeleton />
            </li>
          ))}
        </ul>
      ) : !data || data.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {data.map((v, i) => (
            <li
              key={v.id}
              className="animate-rise"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <VoucherTicket
                voucher={v}
                onClaim={() =>
                  setConfirming({
                    id: v.id,
                    title: v.title,
                    hours: v.claim_window_hours,
                    terms: v.terms,
                    recurring: v.is_recurring,
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Claim this voucher?</AlertDialogTitle>
            <AlertDialogDescription>
              Once claimed, "{confirming?.title}" is yours and yours alone - you'll have{" "}
              {confirming?.hours} hours to redeem it in person at So Love Krugersdorp.
              {confirming?.recurring
                ? " This one renews monthly, so it'll be back for you next month."
                : " This action can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirming?.terms && (
            <Collapsible className="border border-border rounded-xl overflow-hidden">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors [&[data-state=open]>svg:last-child]:rotate-180">
                <span className="inline-flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Terms &amp; Conditions
                </span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4 pt-1 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed border-t border-border">
                {confirming.terms}
              </CollapsibleContent>
            </Collapsible>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirming) claim.mutate(confirming.id);
              }}
              disabled={claim.isPending}
            >
              {claim.isPending ? <Loader2 className="size-4 animate-spin" /> : "Yes, claim it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PageHeader({ count, loading }: { count: number; loading: boolean }) {
  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          <UserRound className="size-3" />
          Members only
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-[2.75rem] md:leading-[1.05]">
          Vouchers
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground md:text-base">
          Claim one, then redeem it in store before the window closes.
        </p>
      </div>
      <div className="flex items-center gap-2 self-start rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold md:self-auto">
        <TicketPercent className="size-4 text-primary" />
        {loading ? "Loading…" : `${count} available`}
      </div>
    </header>
  );
}

function EmptyState() {
  return (
    <TicketBlock notchY="50%" className="mx-auto max-w-md">
      <div className="px-8 pb-6 pt-10 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <TicketPercent className="size-7" />
        </div>
        <p className="mt-4 text-lg font-bold">No vouchers right now</p>
      </div>
      <Perforation />
      <p className="px-8 pb-10 pt-6 text-center text-sm text-muted-foreground">
        New drops land regularly — check back soon, or look under Mine for the ones you've already
        claimed.
      </p>
    </TicketBlock>
  );
}

function VoucherTicket({ voucher: v, onClaim }: { voucher: Voucher; onClaim: () => void }) {
  return (
    // The footer is a fixed 76px (44px button + 2×16px padding), so the punched
    // notches and the perforation always meet on the same line.
    <TicketBlock notchY="calc(100% - 76px)">
      <div className="relative overflow-hidden rounded-t-3xl">
        <SmartImage
          src={v.image_url}
          alt={v.title}
          wrapperClassName="aspect-[4/3]"
          className="transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.78),rgba(0,0,0,0.25)_32%,rgba(0,0,0,0)_62%)]" />

        <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2">
          {v.is_recurring ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-neutral-900 shadow-sm backdrop-blur">
              <Repeat className="size-3 text-primary" />
              Monthly
            </span>
          ) : (
            <span />
          )}
          {v.value_text && (
            <span className="rounded-full bg-primary px-3 py-1 text-[13px] font-bold text-primary-foreground shadow-lg shadow-black/20">
              {v.value_text}
            </span>
          )}
        </div>

        <div className="absolute inset-x-4 bottom-4 flex items-center gap-2.5">
          <div className="size-9 shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-white/80">
            {v.business_logo_url ? (
              <img
                src={v.business_logo_url}
                alt=""
                className="size-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="grid size-full place-items-center">
                <Store className="size-4 text-neutral-500" />
              </div>
            )}
          </div>
          {v.business_name && (
            <p className="truncate text-sm font-semibold tracking-tight text-white drop-shadow">
              {v.business_name}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-lg font-bold leading-snug tracking-tight">{v.title}</h2>
        {v.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {v.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.05] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Clock className="size-3" />
            {v.claim_window_hours}h to redeem
          </span>
          <span className="font-serial text-[10px] text-muted-foreground/70">
            Nº {serialOf(v.id)}
          </span>
        </div>
      </div>

      <Perforation />

      <div className="p-4">
        <Button
          className="h-11 w-full rounded-full text-sm font-semibold shadow-sm transition-transform active:scale-[0.99]"
          onClick={onClaim}
        >
          <CheckCircle2 className="size-4" />
          Claim voucher
        </Button>
      </div>
    </TicketBlock>
  );
}
