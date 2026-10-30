import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AdminModal,
  ModalBody,
  FormSection,
  Field,
  DateTimeField,
  ToggleRow,
  ModalFooter,
  ConfirmDialog,
  Panel,
} from "@/components/admin/form-kit";
import { ImageUploader } from "@/components/image-uploader";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { Plus, Pencil, Trash2, Loader2, Mic2, CalendarDays } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/breakfast")({
  component: AdminBreakfastPage,
});

type MeetingRow = {
  id: string;
  meeting_date: string;
  speaker_name: string | null;
  speaker_title: string | null;
  speaker_bio: string | null;
  speaker_image_url: string | null;
  topic: string | null;
  is_published: boolean;
};

type EditState = Partial<MeetingRow> & {
  __open: boolean;
  meeting_date_date?: string;
  meeting_date_time?: string;
};

const empty: EditState = {
  __open: true,
  meeting_date: "",
  meeting_date_date: "",
  meeting_date_time: "",
  speaker_name: "",
  speaker_title: "",
  speaker_bio: "",
  speaker_image_url: null,
  topic: "",
  is_published: true,
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

function AdminBreakfastPage() {
  const qc = useQueryClient();
  useRealtimeInvalidate("breakfast_meetings", [["admin-breakfast"]]);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleting, setDeleting] = useState<MeetingRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-breakfast"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("breakfast_meetings")
        .select("*")
        .order("meeting_date", { ascending: true });
      if (error) throw error;
      return data as MeetingRow[];
    },
  });

  const save = useMutation({
    mutationFn: async (e: EditState) => {
      const meetingAt = combineDatetime(e.meeting_date_date ?? "", e.meeting_date_time ?? "");
      if (!meetingAt) throw new Error("Meeting date is required");
      const payload = {
        meeting_date: new Date(meetingAt).toISOString(),
        speaker_name: e.speaker_name || null,
        speaker_title: e.speaker_title || null,
        speaker_bio: e.speaker_bio || null,
        speaker_image_url: e.speaker_image_url ?? null,
        topic: e.topic || null,
        is_published: e.is_published ?? true,
      };
      if (e.id) {
        const { error } = await supabase.from("breakfast_meetings").update(payload).eq("id", e.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("breakfast_meetings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-breakfast"] });
      setEdit(null);
    },
    onError: (e) => toast.error(e.message || "Failed to save"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("breakfast_meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-breakfast"] });
      setDeleting(null);
    },
    onError: (e) => toast.error(e.message || "Failed to delete"),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary font-semibold">Admin</p>
          <h1 className="text-3xl font-bold mt-1">Breakfast Meetings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            These dates are the schedule members see. Add one for every sitting; remove it and it
            disappears from the booking page.
          </p>
        </div>
        <Button onClick={() => setEdit(empty)} className="rounded-full px-5 shadow-sm shrink-0">
          <Plus className="size-4 mr-1.5" /> Add date
        </Button>
      </header>

      {isLoading ? (
        <div className="py-10 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.length === 0 ? (
        <Card className="p-10 text-center border-dashed bg-muted/25 rounded-2xl">
          <div className="size-12 mx-auto rounded-2xl bg-primary/10 text-primary grid place-items-center mb-3">
            <Mic2 className="size-6" />
          </div>
          <p className="font-semibold">No dates yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add a breakfast date — members see nothing under Upcoming dates until you do.
          </p>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-2.5">
          {data.map((m) => (
            <li key={m.id}>
              <Card className="p-3.5 flex flex-wrap items-center gap-x-4 gap-y-2.5 sm:flex-nowrap rounded-2xl border-border/70 shadow-sm transition-all hover:border-border hover:shadow-md">
                <div className="size-14 sm:size-16 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border/50">
                  {m.speaker_image_url ? (
                    <img src={m.speaker_image_url} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="size-full grid place-items-center text-muted-foreground/50">
                      <Mic2 className="size-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold truncate">{m.speaker_name ?? "Speaker TBA"}</h3>
                    {!m.is_published && (
                      <Badge variant="secondary" className="text-[10px] rounded-full">
                        Hidden
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3" />
                    {new Date(m.meeting_date).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  {m.topic && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      Topic: {m.topic}
                    </p>
                  )}
                </div>
                <div className="flex w-full shrink-0 justify-end gap-1 border-t border-border/60 pt-2 sm:w-auto sm:border-0 sm:pt-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full"
                    aria-label={`Edit ${m.speaker_name ?? "meeting"}`}
                    onClick={() => {
                      const dt = toLocalInput(m.meeting_date);
                      setEdit({
                        __open: true,
                        ...m,
                        meeting_date_date: dt.date,
                        meeting_date_time: dt.time,
                      });
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label={`Delete ${m.speaker_name ?? "meeting"}`}
                    onClick={() => setDeleting(m)}
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
        eyebrow="Breakfast"
        icon={Mic2}
        title={edit?.id ? "Edit date" : "Add date"}
        description="The date shows under Upcoming dates for everyone. Speaker details are optional."
        footer={
          <ModalFooter
            hint={
              edit?.id
                ? "Saving updates the booking page instantly."
                : "Adds this date to the breakfast booking page."
            }
            onCancel={() => setEdit(null)}
            onSave={() => edit && save.mutate(edit)}
            saving={save.isPending}
            saveLabel={edit?.id ? "Save changes" : "Add date"}
          />
        }
      >
        {edit && (
          <ModalBody>
            <FormSection title="Speaker">
              <Panel className="flex justify-center">
                <ImageUploader
                  value={edit.speaker_image_url}
                  onChange={(url) => setEdit({ ...edit, speaker_image_url: url })}
                  folder="breakfast"
                  shape="circle"
                  label="Speaker photo"
                />
              </Panel>
              <Field label="Speaker name">
                <Input
                  placeholder="e.g. Jane Dlamini"
                  value={edit.speaker_name ?? ""}
                  onChange={(e) => setEdit({ ...edit, speaker_name: e.target.value })}
                />
              </Field>
              <Field label="Speaker title / role">
                <Input
                  placeholder="e.g. Founder of Acme Co."
                  value={edit.speaker_title ?? ""}
                  onChange={(e) => setEdit({ ...edit, speaker_title: e.target.value })}
                />
              </Field>
              <Field label="Topic">
                <Input
                  placeholder="What they'll be speaking about"
                  value={edit.topic ?? ""}
                  onChange={(e) => setEdit({ ...edit, topic: e.target.value })}
                />
              </Field>
              <Field label="Speaker bio">
                <Textarea
                  rows={4}
                  placeholder="A short introduction to the speaker..."
                  value={edit.speaker_bio ?? ""}
                  onChange={(e) => setEdit({ ...edit, speaker_bio: e.target.value })}
                />
              </Field>
            </FormSection>

            <FormSection title="Date &amp; time">
              <DateTimeField
                label="Meeting date and time"
                required
                dateValue={edit.meeting_date_date ?? ""}
                timeValue={edit.meeting_date_time ?? ""}
                onDate={(v) => setEdit({ ...edit, meeting_date_date: v })}
                onTime={(v) => setEdit({ ...edit, meeting_date_time: v })}
              />
            </FormSection>

            <FormSection title="Visibility">
              <ToggleRow label="Published" description="Shown on the breakfast booking page.">
                <Switch
                  id="published"
                  checked={edit.is_published ?? true}
                  onCheckedChange={(v) => setEdit({ ...edit, is_published: v })}
                />
              </ToggleRow>
            </FormSection>
          </ModalBody>
        )}
      </AdminModal>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        icon={Trash2}
        title="Delete this meeting?"
        description="This will remove the speaker info from the booking page."
        onConfirm={() => deleting && del.mutate(deleting.id)}
        loading={del.isPending}
        confirmLabel="Delete meeting"
      />
    </div>
  );
}
