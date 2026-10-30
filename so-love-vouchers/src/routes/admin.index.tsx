import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Ticket,
  Users,
  Loader2,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  Table2,
  MapPin,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format, startOfDay, subDays, formatDistanceToNowStrict } from "date-fns";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];

const SERIES = [
  { key: "claimed" as const, label: "Claimed", color: "var(--series-claimed)" },
  { key: "redeemed" as const, label: "Redeemed", color: "var(--series-redeemed)" },
];

/** Recent activity is a teaser: five rows, then "All redemptions" for the rest.
    The fetch and the render share this so the card can't quietly grow. */
const RECENT_ACTIVITY_ROWS = 5;

function AdminDashboard() {
  const [range, setRange] = useState<Range>(14);
  const [view, setView] = useState<"chart" | "table">("chart");

  useRealtimeInvalidate("vouchers", [["admin-stats"]]);
  useRealtimeInvalidate("events", [["admin-stats"], ["admin-upcoming-events"]]);
  useRealtimeInvalidate("voucher_claims", [
    ["admin-stats"],
    ["admin-trend"],
    ["admin-recent-claims"],
  ]);

  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const todayStart = startOfDay(new Date());
      const yesterdayStart = subDays(todayStart, 1);
      const weekAgo = subDays(todayStart, 7);

      const [
        events,
        vouchers,
        claimsToday,
        redeemedToday,
        claimsYesterday,
        redeemedYesterday,
        members,
        newMembers,
      ] = await Promise.all([
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase
          .from("vouchers")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("voucher_claims")
          .select("id", { count: "exact", head: true })
          .gte("claimed_at", todayStart.toISOString()),
        supabase
          .from("voucher_claims")
          .select("id", { count: "exact", head: true })
          .gte("redeemed_at", todayStart.toISOString()),
        supabase
          .from("voucher_claims")
          .select("id", { count: "exact", head: true })
          .gte("claimed_at", yesterdayStart.toISOString())
          .lt("claimed_at", todayStart.toISOString()),
        supabase
          .from("voucher_claims")
          .select("id", { count: "exact", head: true })
          .gte("redeemed_at", yesterdayStart.toISOString())
          .lt("redeemed_at", todayStart.toISOString()),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", weekAgo.toISOString()),
      ]);

      return {
        events: events.count ?? 0,
        vouchers: vouchers.count ?? 0,
        claimsToday: claimsToday.count ?? 0,
        redeemedToday: redeemedToday.count ?? 0,
        claimsYesterday: claimsYesterday.count ?? 0,
        redeemedYesterday: redeemedYesterday.count ?? 0,
        members: members.count ?? 0,
        newMembers: newMembers.count ?? 0,
      };
    },
    staleTime: 60_000,
  });

  const trend = useQuery({
    queryKey: ["admin-trend", range],
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: async () => {
      const start = subDays(startOfDay(new Date()), range - 1);
      const iso = start.toISOString();
      const { data, error } = await supabase
        .from("voucher_claims")
        .select("claimed_at, redeemed_at")
        .or(`claimed_at.gte.${iso},redeemed_at.gte.${iso}`)
        .limit(5000);
      if (error) throw error;

      const buckets = new Map<string, { claimed: number; redeemed: number }>();
      for (let i = 0; i < range; i++) {
        buckets.set(format(subDays(startOfDay(new Date()), range - 1 - i), "yyyy-MM-dd"), {
          claimed: 0,
          redeemed: 0,
        });
      }
      for (const row of data ?? []) {
        const c = format(new Date(row.claimed_at), "yyyy-MM-dd");
        if (buckets.has(c)) buckets.get(c)!.claimed++;
        if (row.redeemed_at) {
          const r = format(new Date(row.redeemed_at), "yyyy-MM-dd");
          if (buckets.has(r)) buckets.get(r)!.redeemed++;
        }
      }
      return Array.from(buckets.entries()).map(([day, v]) => ({
        day,
        label: format(new Date(day), "d MMM"),
        ...v,
      }));
    },
  });

  const recent = useQuery({
    queryKey: ["admin-recent-claims"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: claims, error } = await supabase
        .from("voucher_claims")
        .select("id, user_id, claimed_at, redeemed_at, vouchers (title)")
        .order("claimed_at", { ascending: false })
        .limit(RECENT_ACTIVITY_ROWS);
      if (error) throw error;
      const ids = Array.from(new Set((claims ?? []).map((c) => c.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, first_name, last_name, email")
        .in("id", ids);
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (claims ?? []).map((c) => {
        const p = map.get(c.user_id);
        const name =
          p?.display_name ||
          [p?.first_name, p?.last_name].filter(Boolean).join(" ") ||
          p?.email ||
          "Unknown member";
        return {
          id: c.id,
          name,
          voucher: c.vouchers?.title ?? "Voucher",
          claimedAt: c.claimed_at,
          redeemed: !!c.redeemed_at,
        };
      });
    },
  });

  const upcoming = useQuery({
    queryKey: ["admin-upcoming-events"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, starts_at, location, is_published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const rows = trend.data ?? [];
    const claimed = rows.reduce((s, r) => s + r.claimed, 0);
    const redeemed = rows.reduce((s, r) => s + r.redeemed, 0);
    return { claimed, redeemed, rate: claimed ? Math.round((redeemed / claimed) * 100) : 0 };
  }, [trend.data]);

  const today = new Date().toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary font-semibold">Admin</p>
          <h1
            className="text-3xl md:text-4xl font-bold mt-1 tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">{today}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 border border-border/60 rounded-full px-3 py-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Live
        </span>
      </header>

      {stats.isLoading || !stats.data ? (
        <div className="py-10 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Stat
            label="Claimed today"
            value={stats.data.claimsToday}
            delta={stats.data.claimsToday - stats.data.claimsYesterday}
            deltaLabel="vs yesterday"
            accent
          />
          <Stat
            label="Redeemed today"
            value={stats.data.redeemedToday}
            delta={stats.data.redeemedToday - stats.data.redeemedYesterday}
            deltaLabel="vs yesterday"
            accent
          />
          <Stat
            label="Active vouchers"
            value={stats.data.vouchers}
            icon={Ticket}
            foot={`${stats.data.events} event${stats.data.events === 1 ? "" : "s"} total`}
          />
          <Stat
            label="Members"
            value={stats.data.members}
            icon={Users}
            foot={
              stats.data.newMembers > 0
                ? `+${stats.data.newMembers} in the last 7 days`
                : "No joins this week"
            }
          />
        </div>
      )}

      {/* Filter row — scopes everything in the activity section below */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  range === r
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r} days
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => setView("chart")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                view === "chart"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={view === "chart"}
            >
              <BarChart3 className="size-3.5" /> Chart
            </button>
            <button
              onClick={() => setView("table")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                view === "table"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={view === "table"}
            >
              <Table2 className="size-3.5" /> Table
            </button>
          </div>
        </div>

        <Card className="p-5 rounded-2xl">
          {/* Summary + legend. Identity is never colour alone: every swatch is
              paired with its series name and its total for the window. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 mb-5">
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {SERIES.map((s) => (
                <SummaryStat
                  key={s.key}
                  label={s.label}
                  color={s.color}
                  value={s.key === "claimed" ? totals.claimed : totals.redeemed}
                />
              ))}
              <SummaryStat label="Redemption rate" value={`${totals.rate}%`} />
            </div>
            <p className="text-xs text-muted-foreground">Last {range} days</p>
          </div>

          {trend.isLoading ? (
            <div className="h-[260px] grid place-items-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className={cn("transition-opacity", trend.isFetching && "opacity-60")}>
              {view === "chart" ? (
                <ActivityChart data={trend.data ?? []} />
              ) : (
                <ActivityTable data={trend.data ?? []} />
              )}
            </div>
          )}
        </Card>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent activity */}
        <Card className="p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            <Link
              to="/admin/redemptions"
              className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
            >
              All redemptions <ArrowRight className="size-3" />
            </Link>
          </div>
          {recent.isLoading ? (
            <div className="py-10 grid place-items-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : !recent.data?.length ? (
            <EmptyNote>No vouchers claimed yet.</EmptyNote>
          ) : (
            <ul className="divide-y divide-border -mx-1">
              {recent.data.slice(0, RECENT_ACTIVITY_ROWS).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-1 py-2.5">
                  <span
                    className={cn(
                      "size-8 rounded-lg grid place-items-center shrink-0",
                      r.redeemed
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {r.redeemed ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <Clock className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.voucher}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatDistanceToNowStrict(new Date(r.claimedAt), { addSuffix: true })}
                    </p>
                    <p
                      className={cn(
                        "text-[11px] font-medium",
                        r.redeemed
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {r.redeemed ? "Redeemed" : "Pending"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Upcoming events */}
        <Card className="p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Upcoming events</h2>
            <Link
              to="/admin/events"
              className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
            >
              Manage <ArrowRight className="size-3" />
            </Link>
          </div>
          {upcoming.isLoading ? (
            <div className="py-10 grid place-items-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : !upcoming.data?.length ? (
            <EmptyNote>Nothing scheduled. Create an event to fill the calendar.</EmptyNote>
          ) : (
            <ul className="divide-y divide-border -mx-1">
              {upcoming.data.map((e) => {
                const d = new Date(e.starts_at);
                return (
                  <li key={e.id} className="flex items-center gap-3 px-1 py-2.5">
                    <div className="size-10 rounded-lg border border-border bg-muted/40 grid place-items-center shrink-0 leading-none">
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold">
                        {format(d, "MMM")}
                      </span>
                      <span className="text-sm font-bold tabular-nums">{format(d, "d")}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        {format(d, "HH:mm")}
                        {e.location && (
                          <>
                            <span aria-hidden>·</span>
                            <MapPin className="size-3 shrink-0" />
                            {e.location}
                          </>
                        )}
                      </p>
                    </div>
                    {!e.is_published && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
                        Draft
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-3">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <QuickLink to="/admin/vouchers" label="New voucher" />
          <QuickLink to="/admin/events" label="New event" />
          <QuickLink to="/admin/redemptions" label="View redemptions" />
          <QuickLink to="/admin/members" label="Members" />
        </div>
      </section>
    </div>
  );
}

/** Summary figure above the chart. The label row is a fixed-height flex row in
    every case, so items with a colour swatch and items without (the derived
    redemption rate) keep the same label and value baselines. */
function SummaryStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 h-4">
        {color && <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />}
        <span className="text-xs text-muted-foreground leading-none">{label}</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight mt-1">{value}</p>
    </div>
  );
}

type TrendRow = { day: string; label: string; claimed: number; redeemed: number };

function ActivityChart({ data }: { data: TrendRow[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 44, bottom: 4, left: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray="0"
          />
          <XAxis
            dataKey="label"
            // Thin ticks by available width rather than by a fixed step, so
            // date labels never collide on a narrow screen.
            interval="preserveStartEnd"
            minTickGap={28}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            dy={4}
          />
          <YAxis
            allowDecimals={false}
            width={30}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={<ChartTooltip />}
          />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
              label={<EndpointLabel total={data.length} dy={s.key === "claimed" ? -10 : 16} />}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Direct-labels the final point of a series only — never every point.
    The label wears the text token, not the series colour: the coloured line
    end sitting right beside it is what carries series identity. (Recharts does
    not forward `stroke` to a custom label, so relying on it renders black.) */
function EndpointLabel(props: {
  total?: number;
  dy?: number;
  index?: number;
  x?: number;
  y?: number;
  value?: number;
}) {
  const { total = 0, dy = 0, index, x, y, value } = props;
  if (index !== total - 1 || x == null || y == null) return null;
  return (
    <text
      x={x + 8}
      y={y + dy}
      fill="var(--foreground)"
      fontSize={12}
      fontWeight={600}
      textAnchor="start"
      dominantBaseline="middle"
    >
      {value}
    </text>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-[11px] text-muted-foreground mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <span className="size-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-semibold tabular-nums ml-auto">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/** The WCAG-clean twin of the chart — every plotted value, readable without colour. */
function ActivityTable({ data }: { data: TrendRow[] }) {
  return (
    <div className="max-h-[280px] overflow-y-auto -mx-1">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="text-xs text-muted-foreground border-b border-border">
            <th className="text-left font-medium py-2 px-1">Day</th>
            <th className="text-right font-medium py-2 px-1">Claimed</th>
            <th className="text-right font-medium py-2 px-1">Redeemed</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.day} className="border-b border-border/60 last:border-0">
              <td className="py-2 px-1">{r.label}</td>
              <td className="py-2 px-1 text-right tabular-nums">{r.claimed}</td>
              <td className="py-2 px-1 text-right tabular-nums">{r.redeemed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground py-8 text-center">{children}</p>;
}

function QuickLink({
  to,
  label,
}: {
  to: "/admin/vouchers" | "/admin/events" | "/admin/redemptions" | "/admin/members";
  label: string;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:border-primary/40 hover:text-primary transition-colors"
    >
      {label}
      <ArrowRight className="size-3.5" />
    </Link>
  );
}

function Stat({
  label,
  value,
  delta,
  deltaLabel,
  foot,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  delta?: number;
  deltaLabel?: string;
  foot?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <Card className={cn("rounded-2xl p-5", accent ? "border-primary/25" : "border-border")}>
      {/* Fixed-height header row (matching the size-7 icon chip) so cards with
          and without an icon keep the same value baseline across the grid. */}
      <div className="flex items-center justify-between gap-2 h-7">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold truncate">
          {label}
        </span>
        {Icon && (
          <span className="grid place-items-center size-7 rounded-lg bg-muted text-muted-foreground shrink-0">
            <Icon className="size-3.5" />
          </span>
        )}
      </div>

      {/* Proportional figures — tabular-nums only where numbers stack. */}
      <p className="text-4xl font-bold mt-3 tracking-tight">{value}</p>

      {delta !== undefined && deltaLabel ? (
        <Delta value={delta} label={deltaLabel} />
      ) : foot ? (
        <p className="text-xs text-muted-foreground mt-2">{foot}</p>
      ) : null}
    </Card>
  );
}

/** Absolute change, not a percentage — on daily counts this small a
    percentage swings wildly and misleads (0 → 1 is not "+100%"). */
function Delta({ value, label }: { value: number; label: string }) {
  const up = value > 0;
  const flat = value === 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="text-xs mt-2 flex items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-medium",
          flat
            ? "text-muted-foreground"
            : up
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground",
        )}
      >
        <Icon className="size-3" />
        {flat ? "No change" : `${up ? "+" : ""}${value}`}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </p>
  );
}
