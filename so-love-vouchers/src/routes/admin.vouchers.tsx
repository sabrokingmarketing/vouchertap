import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AdminModal,
  ModalBody,
  FormSection,
  Field,
  FieldRow,
  DateTimeField,
  ToggleRow,
  ModalFooter,
  ConfirmDialog,
  InfoNote,
  Panel,
} from "@/components/admin/form-kit";
import { ImageUploader } from "@/components/image-uploader";
import { VoucherRedemptionsModal, type VoucherRef } from "@/components/admin/voucher-redemptions";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Ticket,
  Repeat,
  Bell,
  Search,
  ArrowDownAZ,
  Receipt,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { broadcastPush } from "@/lib/push.functions";

export const Route = createFileRoute("/admin/vouchers")({
  component: AdminVouchersPage,
});

type VoucherRow = {
  id: string;
  title: string;
  description: string | null;
  value_text: string | null;
  terms: string | null;
  image_url: string | null;
  business_name: string | null;
  business_logo_url: string | null;
  business_phone: string | null;
  business_address: string | null;
  claim_window_hours: number;
  available_from: string;
  available_until: string | null;
  is_active: boolean;
  is_recurring: boolean;
  created_at: string;
};

/** How the voucher list is ordered. Alphabetical is the default so an admin
 *  can find an offer by name the way they'd find it in a phone book. */
const SORTS = {
  name_asc: { label: "Name (A–Z)", compare: (a: VoucherRow, b: VoucherRow) => cmpName(a, b) },
  name_desc: { label: "Name (Z–A)", compare: (a: VoucherRow, b: VoucherRow) => cmpName(b, a) },
  newest: {
    label: "Newest added",
    compare: (a: VoucherRow, b: VoucherRow) => b.created_at.localeCompare(a.created_at),
  },
  oldest: {
    label: "Oldest added",
    compare: (a: VoucherRow, b: VoucherRow) => a.created_at.localeCompare(b.created_at),
  },
} as const;

type SortKey = keyof typeof SORTS;

function cmpName(a: VoucherRow, b: VoucherRow) {
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
}

type EditState = Partial<VoucherRow> & {
  __open: boolean;
  available_from_date?: string;
  available_from_time?: string;
  available_until_date?: string;
  available_until_time?: string;
};

const empty: EditState = {
  __open: true,
  title: "",
  description: "",
  value_text: "",
  terms: "",
  image_url: null,
  business_name: "",
  business_logo_url: null,
  business_phone: "",
  business_address: "",
  claim_window_hours: 48,
  available_from: "",
  available_until: "",
  is_active: true,
  available_from_date: "",
  available_from_time: "",
  available_until_date: "",
  available_until_time: "",
};

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function combineDatetime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

function AdminVouchersPage() {
  const qc = useQueryClient();
  useRealtimeInvalidate("vouchers", [["admin-vouchers"]]);
  useRealtimeInvalidate("voucher_claims", [["admin-voucher-claim-counts"]]);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleting, setDeleting] = useState<VoucherRow | null>(null);
  const [viewing, setViewing] = useState<VoucherRef | null>(null);
  const [sort, setSort] = useState<SortKey>("name_asc");
  const [q, setQ] = useState("");
  const sendPush = useServerFn(broadcastPush);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-vouchers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .order("title", { ascending: true });
      if (error) throw error;
      return data as VoucherRow[];
    },
  });

  /** Claim + redemption tallies per voucher, so every row in the list carries
   *  its own performance at a glance. */
  const { data: counts } = useQuery({
    queryKey: ["admin-voucher-claim-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voucher_claims")
        .select("voucher_id, redeemed_at")
        .limit(20000);
      if (error) throw error;
      const map = new Map<string, { claimed: number; redeemed: number }>();
      for (const row of data ?? []) {
        const entry = map.get(row.voucher_id) ?? { claimed: 0, redeemed: 0 };
        entry.claimed += 1;
        if (row.redeemed_at) entry.redeemed += 1;
        map.set(row.voucher_id, entry);
      }
      return map;
    },
    staleTime: 30_000,
  });

  /** New vouchers land in this list automatically — the sort and the search
   *  are applied to whatever the query currently holds. */
  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? [])
      .filter(
        (v) =>
          !term ||
          v.title.toLowerCase().includes(term) ||
          (v.business_name ?? "").toLowerCase().includes(term) ||
          (v.value_text ?? "").toLowerCase().includes(term),
      )
      .slice()
      .sort(SORTS[sort].compare);
  }, [data, q, sort]);

  const save = useMutation({
    mutationFn: async (e: EditState) => {
      const fromStr = combineDatetime(e.available_from_date ?? "", e.available_from_time ?? "");
      const untilStr = combineDatetime(e.available_until_date ?? "", e.available_until_time ?? "");
      const payload = {
        title: (e.title ?? "").trim(),
        description: e.description || null,
        value_text: e.value_text || null,
        terms: e.terms || null,
        image_url: e.image_url ?? null,
        business_name: e.business_name || null,
        business_logo_url: e.business_logo_url ?? null,
        business_phone: e.business_phone || null,
        business_address: e.business_address || null,
        claim_window_hours: Number(e.claim_window_hours) || 48,
        available_from: fromStr ? new Date(fromStr).toISOString() : new Date().toISOString(),
        available_until: untilStr ? new Date(untilStr).toISOString() : null,
        is_active: e.is_active ?? true,
        is_recurring: e.is_recurring ?? false,
      };
      if (!payload.title) throw new Error("Title is required");
      const isNew = !e.id;
      if (e.id) {
        const { error } = await supabase.from("vouchers").update(payload).eq("id", e.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vouchers").insert(payload);
        if (error) throw error;
      }

      // Auto-send push notification when a new active voucher is created
      if (isNew && payload.is_active) {
        const title = `New voucher: ${payload.title}`;
        const body = payload.value_text
          ? `${payload.value_text}${payload.business_name ? ` at ${payload.business_name}` : ""}. Tap to claim.`
          : "A new voucher is now available. Tap to claim.";
        try {
          const res = await sendPush({
            data: {
              title,
              body,
              category: "vouchers",
              url: "/app/vouchers",
              image: payload.image_url || undefined,
            },
          });
          toast.success(`Notification sent to ${res.sent} device${res.sent === 1 ? "" : "s"}`);
        } catch (err) {
          toast.error(
            `Notification not sent: ${err instanceof Error ? err.message : "unknown error"}`,
          );
        }
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
      setEdit(null);
    },
    onError: (e) => toast.error(e.message || "Failed to save"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vouchers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
      qc.invalidateQueries({ queryKey: ["admin-voucher-claim-counts"] });
      setDeleting(null);
    },
    onError: (e) => toast.error(e.message || "Failed to delete"),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary font-semibold">Admin</p>
          <h1 className="text-3xl font-bold mt-1">Vouchers</h1>
        </div>
        <Button onClick={() => setEdit(empty)} className="rounded-full px-5 shadow-sm">
          <Plus className="size-4 mr-1.5" /> New voucher
        </Button>
      </header>

      {data && data.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search vouchers by name or business"
              className="h-10 rounded-full pl-9"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-10 w-[178px] rounded-full" aria-label="Sort vouchers">
              <ArrowDownAZ className="size-4 shrink-0 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORTS) as SortKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {SORTS[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground tabular-nums">
            {visible.length} of {data.length}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="py-10 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.length === 0 ? (
        <Card className="p-10 text-center border-dashed bg-muted/25 rounded-2xl">
          <div className="size-12 mx-auto rounded-2xl bg-primary/10 text-primary grid place-items-center mb-3">
            <Ticket className="size-6" />
          </div>
          <p className="font-semibold">No vouchers yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first voucher to make it available to members.
          </p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center border-dashed bg-muted/25 rounded-2xl">
          <p className="font-semibold">No vouchers match “{q}”</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try a different name, or clear the search to see all {data.length}.
          </p>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-2.5">
          {visible.map((v) => (
            <li key={v.id}>
              <Card className="p-3.5 flex flex-wrap items-center gap-x-4 gap-y-2.5 sm:flex-nowrap rounded-2xl border-border/70 shadow-sm transition-all hover:border-border hover:shadow-md">
                <div className="size-14 sm:size-16 rounded-xl bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border/50">
                  {v.image_url ? (
                    <img src={v.image_url} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="size-full grid place-items-center text-muted-foreground/50">
                      <Ticket className="size-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold truncate">{v.title}</h3>
                    {v.value_text && (
                      <Badge className="text-[10px] rounded-full bg-primary text-primary-foreground">
                        {v.value_text}
                      </Badge>
                    )}
                    {v.is_recurring && (
                      <Badge
                        variant="outline"
                        className="text-[10px] rounded-full gap-1 border-primary/40 text-primary"
                      >
                        <Repeat className="size-3" /> Monthly
                      </Badge>
                    )}
                    {!v.is_active && (
                      <Badge variant="secondary" className="text-[10px] rounded-full">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {v.claim_window_hours}h to redeem · available from{" "}
                    {new Date(v.available_from).toLocaleDateString()}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Receipt className="size-3.5" />
                      <span className="tabular-nums">{counts?.get(v.id)?.claimed ?? 0}</span>{" "}
                      claimed
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="size-3.5" />
                      <span className="tabular-nums">{counts?.get(v.id)?.redeemed ?? 0}</span>{" "}
                      redeemed
                    </span>
                  </div>
                </div>
                <div className="flex w-full shrink-0 justify-end gap-1 border-t border-border/60 pt-2 sm:w-auto sm:border-0 sm:pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full max-sm:px-2.5"
                    aria-label={`View redemptions for ${v.title}`}
                    onClick={() =>
                      setViewing({
                        id: v.id,
                        title: v.title,
                        value_text: v.value_text,
                        business_name: v.business_name,
                        image_url: v.image_url,
                      })
                    }
                  >
                    <Receipt className="size-4 sm:mr-1.5" />
                    <span className="max-sm:sr-only">Redemptions</span>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full"
                    aria-label={`Edit ${v.title}`}
                    onClick={() => {
                      const af = toLocalInput(v.available_from);
                      const au = toLocalInput(v.available_until);
                      setEdit({
                        __open: true,
                        ...v,
                        available_from_date: af.date,
                        available_from_time: af.time,
                        available_until_date: au.date,
                        available_until_time: au.time,
                      });
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label={`Delete ${v.title}`}
                    onClick={() => setDeleting(v)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AdminModal
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        eyebrow="Vouchers"
        icon={Ticket}
        size="xl"
        title={edit?.id ? "Edit voucher" : "New voucher"}
        description="Changes are pushed live to every member's app."
        footer={
          <ModalFooter
            hint={
              edit?.id
                ? "Saving updates the live voucher instantly."
                : "Publishing makes it claimable right away."
            }
            onCancel={() => setEdit(null)}
            onSave={() => edit && save.mutate(edit)}
            saving={save.isPending}
            saveLabel={edit?.id ? "Save changes" : "Publish voucher"}
          />
        }
      >
        {edit && (
          <ModalBody>
            <FormSection
              title="Business"
              description="Who's giving the offer — shown on the voucher and the redemption screen."
            >
              <Panel className="grid grid-cols-[auto_1fr] items-center gap-5 max-sm:grid-cols-1 max-sm:justify-items-center max-sm:text-center">
                <ImageUploader
                  value={edit.business_logo_url}
                  onChange={(url) => setEdit({ ...edit, business_logo_url: url })}
                  folder="business-logos"
                  shape="circle"
                  label="Business logo"
                />
                <Field label="Business name" className="w-full max-sm:text-left">
                  <Input
                    placeholder="e.g. Bella Vista Cafe"
                    value={edit.business_name ?? ""}
                    onChange={(e) => setEdit({ ...edit, business_name: e.target.value })}
                  />
                </Field>
              </Panel>
              <FieldRow>
                <Field label="Business tel" hint="Shown to the customer after they claim.">
                  <Input
                    type="tel"
                    placeholder="e.g. 011 000 0000"
                    className="tabular-nums"
                    value={edit.business_phone ?? ""}
                    onChange={(e) => setEdit({ ...edit, business_phone: e.target.value })}
                  />
                </Field>
                <Field label="Address" hint="Where the customer redeems it.">
                  <Input
                    placeholder="e.g. 12 Main Rd, Krugersdorp"
                    value={edit.business_address ?? ""}
                    onChange={(e) => setEdit({ ...edit, business_address: e.target.value })}
                  />
                </Field>
              </FieldRow>
            </FormSection>

            <FormSection
              title="Cover image"
              description="The whole image is shown — never cropped."
            >
              <ImageUploader
                value={edit.image_url}
                onChange={(url) => setEdit({ ...edit, image_url: url })}
                folder="vouchers"
                aspect="16 / 9"
                label="Add a voucher image"
                hint="Landscape works best. JPG, PNG or WebP up to 5MB."
              />
            </FormSection>

            <FormSection title="The offer">
              <FieldRow>
                <Field label="Title" required>
                  <Input
                    placeholder="e.g. Free coffee on us"
                    value={edit.title ?? ""}
                    onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                  />
                </Field>
                <Field label="Value / offer text" hint="The badge members see on the card.">
                  <Input
                    placeholder="e.g. R50 off · Free coffee · 20% off"
                    value={edit.value_text ?? ""}
                    onChange={(e) => setEdit({ ...edit, value_text: e.target.value })}
                  />
                </Field>
              </FieldRow>
              <Field label="Description">
                <Textarea
                  rows={3}
                  placeholder="What the member gets and how to use it..."
                  value={edit.description ?? ""}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                />
              </Field>
              <Field label="Terms &amp; conditions">
                <Textarea
                  rows={2}
                  placeholder="Any limits, exclusions or fine print..."
                  value={edit.terms ?? ""}
                  onChange={(e) => setEdit({ ...edit, terms: e.target.value })}
                />
              </Field>
            </FormSection>

            <FormSection title="Availability">
              <Field
                label="Claim window"
                hint="How long a member has to redeem after claiming."
                className="max-w-56"
              >
                <div className="slk-fieldbox">
                  <input
                    type="number"
                    min={1}
                    className="slk-bare text-sm tabular-nums"
                    value={edit.claim_window_hours ?? 48}
                    onChange={(e) =>
                      setEdit({ ...edit, claim_window_hours: Number(e.target.value) })
                    }
                  />
                  <span className="select-none text-sm font-medium text-muted-foreground">
                    hours
                  </span>
                </div>
              </Field>
              <FieldRow>
                <DateTimeField
                  label="Available from"
                  hint="Leave blank to start right away."
                  dateValue={edit.available_from_date ?? ""}
                  timeValue={edit.available_from_time ?? ""}
                  onDate={(v) => setEdit({ ...edit, available_from_date: v })}
                  onTime={(v) => setEdit({ ...edit, available_from_time: v })}
                />
                <DateTimeField
                  label="Available until"
                  hint="Leave blank for no end date."
                  dateValue={edit.available_until_date ?? ""}
                  timeValue={edit.available_until_time ?? ""}
                  onDate={(v) => setEdit({ ...edit, available_until_date: v })}
                  onTime={(v) => setEdit({ ...edit, available_until_time: v })}
                />
              </FieldRow>

              <ToggleRow
                label="Recurring monthly"
                description="Re-opens for every member at the start of each month — even after they've used it. Perfect for a standing member benefit."
              >
                <Switch
                  id="recurring"
                  checked={edit.is_recurring ?? false}
                  onCheckedChange={(v) => setEdit({ ...edit, is_recurring: v })}
                />
              </ToggleRow>
              <ToggleRow label="Active" description="Visible and claimable in the member app.">
                <Switch
                  id="active"
                  checked={edit.is_active ?? true}
                  onCheckedChange={(v) => setEdit({ ...edit, is_active: v })}
                />
              </ToggleRow>
              <InfoNote icon={Bell}>
                Creating a new active voucher sends a push notification to every opted-in member
                automatically.
              </InfoNote>
            </FormSection>
          </ModalBody>
        )}
      </AdminModal>

      <VoucherRedemptionsModal
        voucher={viewing}
        open={!!viewing}
        onOpenChange={(o) => !o && setViewing(null)}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        icon={Trash2}
        title="Delete this voucher?"
        description={
          <>
            <span className="font-medium text-foreground">{deleting?.title}</span> will disappear
            from the app. Vouchers members have already claimed keep working.
          </>
        }
        onConfirm={() => deleting && del.mutate(deleting.id)}
        loading={del.isPending}
        confirmLabel="Delete voucher"
      />
    </div>
  );
}
