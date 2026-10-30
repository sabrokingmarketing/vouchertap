import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalBody, FormSection } from "@/components/admin/form-kit";
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
import {
  Loader2,
  ShieldCheck,
  ShieldOff,
  Ban,
  RotateCcw,
  Trash2,
  ChevronRight,
  Users,
  Building2,
  Globe,
  Mail,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";

export const Route = createFileRoute("/admin/members")({
  component: AdminMembersPage,
});

type Row = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
  slk_code: string | null;
  phone: string | null;
  work_phone: string | null;
  business_name: string | null;
  business_email: string | null;
  business_website: string | null;
  business_logo_url: string | null;
  created_at: string;
  disabled_at: string | null;
  isAdmin: boolean;
};

function memberName(m: Row) {
  return m.display_name || [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email || "—";
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
        {label}
      </p>
      <p
        className={`text-sm font-medium mt-0.5 truncate ${mono ? "font-serial tracking-wide" : ""} ${
          value ? "text-foreground" : "text-muted-foreground/50"
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function roleErrorMessage(message: string) {
  if (message.includes("cannot_demote_self")) return "You can't demote yourself.";
  if (message.includes("cannot_demote_last_admin")) {
    return "Promote another admin first — you can't remove the last admin.";
  }
  if (message.includes("not_authorized")) return "Only admins can change roles.";
  return message || "Failed to update role";
}

function AdminMembersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  useRealtimeInvalidate("profiles", [["admin-members"]]);
  useRealtimeInvalidate("user_roles", [["admin-members"]]);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [roleConfirm, setRoleConfirm] = useState<{ member: Row; grant: boolean } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-members"],
    queryFn: async () => {
      // Select "*" so the list keeps working even if the onboarding migration
      // (slk_code / work_phone / business_email) hasn't reached the live DB
      // yet — missing columns come back undefined instead of erroring.
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      ]);
      if (error) throw error;
      const adminIds = new Set((roles ?? []).map((r) => r.user_id));
      const rows = (profiles ?? []).map((p) => ({
        ...p,
        isAdmin: adminIds.has(p.id),
      })) as unknown as Row[];
      rows.sort((a, b) => (a.isAdmin === b.isAdmin ? 0 : a.isAdmin ? -1 : 1));
      return rows;
    },
  });

  // Keep the open popup in sync after a mutation refreshes the list.
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-members"] });
  };

  const setRole = useMutation({
    mutationFn: async ({ userId, grant }: { userId: string; grant: boolean }) => {
      const { error } = await supabase.rpc("set_user_role", {
        _user_id: userId,
        _role: "admin",
        _grant: grant,
      });
      if (error) throw error;
    },
    onSuccess: async (_d, vars) => {
      toast.success(
        vars.grant
          ? "Promoted to admin — they can open the admin portal on next login or refresh."
          : "Demoted to member — admin portal access removed.",
      );
      setRoleConfirm(null);
      await refresh();
      // Clear any cached admin check for the target so their next visit is fresh.
      await qc.invalidateQueries({ queryKey: ["is-admin", vars.userId] });
      setViewing((v) => (v && v.id === vars.userId ? { ...v, isAdmin: vars.grant } : v));
    },
    onError: (e) => toast.error(roleErrorMessage(e.message)),
  });

  const setDisabled = useMutation({
    mutationFn: async ({ userId, disabled }: { userId: string; disabled: boolean }) => {
      const { error } = await supabase.rpc("set_member_disabled", {
        _user_id: userId,
        _disabled: disabled,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Updated");
      refresh();
      setViewing((v) =>
        v && v.id === vars.userId
          ? { ...v, disabled_at: vars.disabled ? new Date().toISOString() : null }
          : v,
      );
    },
    onError: (e) => toast.error(e.message || "Failed"),
  });

  // Deletes via the admin-gated delete_member SECURITY DEFINER RPC — same
  // pattern as set_member_disabled/set_user_role, so it runs with the
  // admin's own session and needs no service-role key on the server.
  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("delete_member", { _user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member permanently deleted");
      setToDelete(null);
      setViewing(null);
      refresh();
    },
    onError: (e) => toast.error(e.message || "Failed to delete"),
  });

  const isMe = viewing?.id === user?.id;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary font-semibold">Admin</p>
          <h1 className="text-3xl font-bold mt-1">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tap a member to view their profile, promote them to admin, or demote them.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="size-4 text-primary" />
          {data?.length ?? 0} member{(data?.length ?? 0) === 1 ? "" : "s"}
        </div>
      </header>

      {isLoading ? (
        <div className="py-10 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Users className="size-8 mx-auto text-muted-foreground" />
          <p className="font-semibold mt-3">No members yet</p>
        </Card>
      ) : (
        <Card className="rounded-2xl shadow-lg shadow-black/[0.04] ring-1 ring-black/[0.02] overflow-hidden p-0 divide-y divide-border">
          {data.map((m) => (
            <button
              key={m.id}
              onClick={() => setViewing(m)}
              className="w-full flex items-center gap-3.5 px-4 md:px-5 py-3.5 text-left hover:bg-muted/40 transition-colors"
            >
              <div className="size-10 rounded-full bg-primary/10 text-primary overflow-hidden grid place-items-center font-bold text-sm shrink-0">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="size-full object-cover" />
                ) : (
                  memberName(m).trim().charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{memberName(m)}</p>
                  {m.isAdmin && (
                    <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5">
                      Admin
                    </Badge>
                  )}
                  {m.disabled_at && (
                    <Badge
                      variant="outline"
                      className="text-destructive border-destructive text-[10px] px-1.5"
                    >
                      Disabled
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{m.email}</p>
              </div>
              {m.business_name && (
                <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 border border-border/60 rounded-full px-3 py-1 max-w-[180px]">
                  <Building2 className="size-3 shrink-0" />
                  <span className="truncate">{m.business_name}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
                <span className="hidden sm:inline">View details</span>
                <ChevronRight className="size-4" />
              </span>
            </button>
          ))}
        </Card>
      )}

      {/* Full details popup */}
      <Dialog
        open={!!viewing}
        onOpenChange={(o) => {
          if (!o) {
            setViewing(null);
            setRoleConfirm(null);
          }
        }}
      >
        <DialogContent className="max-w-lg sm:max-w-2xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 md:px-8 py-5 border-b border-border bg-muted/30 shrink-0 text-left">
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">
              Member
            </p>
            <div className="flex items-center gap-4 mt-1">
              <div className="size-14 rounded-full bg-primary/10 text-primary overflow-hidden grid place-items-center font-bold text-lg shrink-0">
                {viewing?.avatar_url ? (
                  <img src={viewing.avatar_url} alt="" className="size-full object-cover" />
                ) : (
                  (viewing ? memberName(viewing) : "?").trim().charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl md:text-2xl truncate">
                  {viewing ? memberName(viewing) : ""}
                </DialogTitle>
                <DialogDescription className="truncate">{viewing?.email}</DialogDescription>
              </div>
              <div className="ml-auto flex gap-1.5 shrink-0">
                {viewing?.isAdmin && (
                  <Badge className="bg-primary text-primary-foreground">Admin</Badge>
                )}
                {viewing?.disabled_at ? (
                  <Badge variant="outline" className="text-destructive border-destructive">
                    Disabled
                  </Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {viewing && (
            <ModalBody>
              <FormSection title="Personal">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-border bg-muted/20 p-4">
                  <InfoRow label="Name" value={viewing.first_name} />
                  <InfoRow label="Surname" value={viewing.last_name} />
                  <InfoRow label="Email" value={viewing.email} />
                  <InfoRow label="Personal tel" value={viewing.phone} mono />
                  <InfoRow label="SLK code" value={viewing.slk_code} mono />
                  <InfoRow
                    label="Joined"
                    value={new Date(viewing.created_at).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  />
                </div>
              </FormSection>

              <FormSection title="Business">
                {viewing.business_name ||
                viewing.business_email ||
                viewing.business_website ||
                viewing.work_phone ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
                    <div className="flex items-center gap-3.5">
                      <div className="size-12 rounded-xl bg-background border border-border overflow-hidden grid place-items-center shrink-0">
                        {viewing.business_logo_url ? (
                          <img
                            src={viewing.business_logo_url}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <Building2 className="size-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">
                          {viewing.business_name || "Company"}
                        </p>
                        {viewing.business_website && (
                          <a
                            href={
                              viewing.business_website.startsWith("http")
                                ? viewing.business_website
                                : `https://${viewing.business_website}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline truncate"
                          >
                            <Globe className="size-3 shrink-0" />
                            {viewing.business_website.replace(/^https?:\/\//, "")}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border/70 pt-4">
                      <InfoRow label="Business email" value={viewing.business_email} />
                      <InfoRow label="Work tel" value={viewing.work_phone} mono />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center">
                    <Building2 className="size-6 mx-auto text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground mt-2">
                      No business info added yet.
                    </p>
                  </div>
                )}
              </FormSection>

              <FormSection title="Admin access">
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  {isMe ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {viewing.isAdmin
                          ? "You are an admin and can open the admin portal."
                          : "You are a member."}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        You can't change your own admin role here.
                      </p>
                    </>
                  ) : roleConfirm && roleConfirm.member.id === viewing.id ? (
                    <>
                      <p className="text-sm text-foreground font-medium">
                        {roleConfirm.grant ? "Promote to admin?" : "Demote from admin?"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {roleConfirm.grant
                          ? "They will get full access to the admin portal (events, vouchers, members, and more)."
                          : "They will lose admin portal access and become a regular member again."}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={setRole.isPending}
                          onClick={() => setRoleConfirm(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant={roleConfirm.grant ? "default" : "outline"}
                          disabled={setRole.isPending}
                          onClick={() => {
                            if (setRole.isPending) return;
                            setRole.mutate({
                              userId: roleConfirm.member.id,
                              grant: roleConfirm.grant,
                            });
                          }}
                        >
                          {setRole.isPending ? (
                            <Loader2 className="size-3.5 animate-spin mr-1.5" />
                          ) : roleConfirm.grant ? (
                            <ShieldCheck className="size-3.5 mr-1.5" />
                          ) : (
                            <ShieldOff className="size-3.5 mr-1.5" />
                          )}
                          {roleConfirm.grant ? "Confirm promote" : "Confirm demote"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {viewing.isAdmin
                          ? "This person is an admin and can open the admin portal."
                          : "Promote this member to admin so they can manage the portal."}
                      </p>
                      <Button
                        size="sm"
                        variant={viewing.isAdmin ? "outline" : "default"}
                        onClick={() => setRoleConfirm({ member: viewing, grant: !viewing.isAdmin })}
                        disabled={setRole.isPending}
                      >
                        {viewing.isAdmin ? (
                          <>
                            <ShieldOff className="size-3.5 mr-1.5" /> Demote from admin
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="size-3.5 mr-1.5" /> Promote to admin
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </FormSection>

              <FormSection title="Quick contact">
                <div className="flex flex-wrap gap-2">
                  {viewing.email && (
                    <Button asChild variant="outline" size="sm" className="rounded-full">
                      <a href={`mailto:${viewing.email}`}>
                        <Mail className="size-3.5 mr-1.5" /> Email
                      </a>
                    </Button>
                  )}
                  {viewing.phone && (
                    <Button asChild variant="outline" size="sm" className="rounded-full">
                      <a href={`tel:${viewing.phone}`}>
                        <Phone className="size-3.5 mr-1.5" /> Call
                      </a>
                    </Button>
                  )}
                </div>
              </FormSection>
            </ModalBody>
          )}

          {viewing && !isMe && (
            <div className="px-6 md:px-8 py-4 border-t border-border bg-muted/30 shrink-0 flex flex-wrap items-center justify-between gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setToDelete(viewing)}
                disabled={removeMember.isPending}
              >
                <Trash2 className="size-3.5 mr-1" /> Delete
              </Button>
              <Button
                size="sm"
                variant={viewing.disabled_at ? "outline" : "destructive"}
                onClick={() =>
                  setDisabled.mutate({ userId: viewing.id, disabled: !viewing.disabled_at })
                }
                disabled={setDisabled.isPending}
              >
                {viewing.disabled_at ? (
                  <>
                    <RotateCcw className="size-3.5 mr-1" /> Enable
                  </>
                ) : (
                  <>
                    <Ban className="size-3.5 mr-1" /> Disable
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-semibold text-foreground">
                {toDelete ? memberName(toDelete) : "this member"}
              </span>{" "}
              from every part of the app - their login, profile, roles, voucher claims and push
              subscriptions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMember.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (toDelete) removeMember.mutate(toDelete.id);
              }}
              disabled={removeMember.isPending}
            >
              {removeMember.isPending ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="size-4 mr-2" />
              )}
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
