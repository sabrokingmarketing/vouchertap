import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/admin/redemptions")({
  component: AdminRedemptionsPage,
});

type ClaimRow = {
  id: string;
  user_id: string;
  voucher_id: string;
  claimed_at: string;
  expires_at: string;
  redeemed_at: string | null;
  vouchers: { title: string; value_text: string | null } | null;
  profiles?: { email: string | null; display_name: string | null } | null;
};

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString(undefined, {
    month: "short",
    year: "numeric",
  });
}

const MONTHS = [
  { value: "all", label: "All months" },
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function AdminRedemptionsPage() {
  useRealtimeInvalidate("voucher_claims", [["admin-claims"]]);
  useRealtimeInvalidate("vouchers", [["admin-voucher-options"]]);
  const [activeMonth, setActiveMonth] = useState<string>("all");
  const [activeYear, setActiveYear] = useState<string>("all");
  const [activeVoucher, setActiveVoucher] = useState<string>("all");

  /** Every voucher, alphabetically — including ones nobody has claimed yet, so
   *  a voucher added a minute ago is already selectable here. */
  const { data: vouchers } = useQuery({
    queryKey: ["admin-voucher-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vouchers")
        .select("id, title")
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .slice()
        .sort((a, b) =>
          a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true }),
        );
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-claims"],
    queryFn: async () => {
      const { data: claims, error } = await supabase
        .from("voucher_claims")
        .select(
          "id, user_id, voucher_id, claimed_at, expires_at, redeemed_at, vouchers (title, value_text)",
        )
        .order("claimed_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const userIds = Array.from(new Set((claims ?? []).map((c) => c.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", userIds);
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (claims ?? []).map((c) => ({
        ...c,
        profiles: map.get(c.user_id) ?? null,
      })) as ClaimRow[];
    },
  });

  const years = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((c) => set.add(String(new Date(c.claimed_at).getFullYear())));
    return Array.from(set).sort().reverse();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((c) => {
      const d = new Date(c.claimed_at);
      const monthOk =
        activeMonth === "all" || String(d.getMonth() + 1).padStart(2, "0") === activeMonth;
      const yearOk = activeYear === "all" || String(d.getFullYear()) === activeYear;
      const voucherOk = activeVoucher === "all" || c.voucher_id === activeVoucher;
      return monthOk && yearOk && voucherOk;
    });
  }, [data, activeMonth, activeYear, activeVoucher]);

  const summary = useMemo(() => {
    const redeemed = filtered.filter((c) => c.redeemed_at).length;
    const expired = filtered.filter(
      (c) => !c.redeemed_at && new Date(c.expires_at) < new Date(),
    ).length;
    return {
      total: filtered.length,
      redeemed,
      expired,
      active: filtered.length - redeemed - expired,
    };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary font-semibold">Admin</p>
          <h1 className="text-3xl font-bold mt-1">Redemptions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live feed of voucher claims and redemptions.
          </p>
        </div>
        <button
          onClick={() => exportCsv(filtered)}
          className="text-xs text-primary hover:underline"
        >
          Export CSV
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={activeVoucher} onValueChange={setActiveVoucher}>
          <SelectTrigger className="w-[240px]" aria-label="Filter by voucher">
            <SelectValue placeholder="Voucher" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vouchers</SelectItem>
            {(vouchers ?? []).map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={activeMonth} onValueChange={setActiveMonth}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={activeYear} onValueChange={setActiveYear}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: "Claims", value: summary.total },
            { label: "Redeemed", value: summary.redeemed, tone: "text-emerald-600" },
            { label: "Active", value: summary.active },
            { label: "Expired", value: summary.expired, tone: "text-muted-foreground" },
          ].map((s) => (
            <Card key={s.label} className="rounded-2xl px-4 py-3">
              <p className={`text-2xl font-bold leading-none tabular-nums ${s.tone ?? ""}`}>
                {s.value}
              </p>
              <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {s.label}
              </p>
            </Card>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="py-10 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <p className="font-semibold text-muted-foreground">
            No claims for {activeMonth === "all" ? "this period" : monthLabel(activeMonth)}
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left p-3">Member</th>
                <th className="text-left p-3">Voucher</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Claimed</th>
                <th className="text-left p-3">Redeemed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const status = c.redeemed_at
                  ? "redeemed"
                  : new Date(c.expires_at) < new Date()
                    ? "expired"
                    : "claimed";
                return (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="p-3 align-top">
                      <div className="font-medium">{c.profiles?.display_name ?? "-"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {c.profiles?.email}
                      </div>
                    </td>
                    <td className="p-3 align-top">
                      <div className="font-medium">{c.vouchers?.title ?? "-"}</div>
                      {c.vouchers?.value_text && (
                        <div className="text-xs text-muted-foreground">{c.vouchers.value_text}</div>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      {status === "redeemed" && (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
                          <CheckCircle2 className="size-3 mr-1" /> Redeemed
                        </Badge>
                      )}
                      {status === "claimed" && (
                        <Badge variant="secondary">
                          <Clock className="size-3 mr-1" /> Active
                        </Badge>
                      )}
                      {status === "expired" && (
                        <Badge variant="outline" className="text-muted-foreground">
                          <XCircle className="size-3 mr-1" /> Expired
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 align-top text-xs text-muted-foreground">
                      {new Date(c.claimed_at).toLocaleString()}
                    </td>
                    <td className="p-3 align-top text-xs text-muted-foreground">
                      {c.redeemed_at ? new Date(c.redeemed_at).toLocaleString() : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function exportCsv(rows: ClaimRow[]) {
  const header = [
    "member_email",
    "member_name",
    "voucher",
    "value",
    "status",
    "claimed_at",
    "redeemed_at",
  ];
  const body = rows.map((c) => {
    const status = c.redeemed_at
      ? "redeemed"
      : new Date(c.expires_at) < new Date()
        ? "expired"
        : "claimed";
    return [
      c.profiles?.email ?? "",
      c.profiles?.display_name ?? "",
      c.vouchers?.title ?? "",
      c.vouchers?.value_text ?? "",
      status,
      c.claimed_at,
      c.redeemed_at ?? "",
    ]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`)
      .join(",");
  });
  const csv = [header.join(","), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `redemptions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
