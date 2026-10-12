/**
 * Event registration — shared rules for the admin editor and the member app.
 *
 * How members register for an event:
 *   "form" — the built-in form (events.registration_enabled); answers land in
 *            event_registrations: name, email and how many will attend
 *   "link" — an external form such as Jotform (events.form_url)
 *   "none" — no registration
 */

export type RegistrationMode = "none" | "link" | "form";

export type EventRegistration = {
  id: string;
  event_id: string;
  user_id: string;
  name: string;
  email: string;
  attendees: number;
  created_at: string;
  updated_at: string;
};

/** Quick picks in the "How many of you will attend?" dropdown. */
export const ATTENDEE_PRESETS = [1, 2, 3, 4, 5] as const;
/** Upper bound for a custom headcount (matches the DB check constraint). */
export const MAX_ATTENDEES = 500;

export function registrationModeOf(ev: {
  registration_enabled?: boolean | null;
  form_url?: string | null;
}): RegistrationMode {
  if (ev.registration_enabled) return "form";
  if (ev.form_url) return "link";
  return "none";
}

export function attendeesLabel(n: number) {
  return `${n} ${n === 1 ? "person" : "people"}`;
}

/** CSV export of an event's registrations (opens cleanly in Excel/Sheets). */
export function registrationsToCsv(rows: EventRegistration[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    // Neutralise spreadsheet formula injection, then quote.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const header = ["Name", "Email", "Attending", "Registered at"].map(esc).join(",");
  const lines = rows.map((r) =>
    [r.name, r.email, r.attendees, new Date(r.created_at).toLocaleString()].map(esc).join(","),
  );
  return [header, ...lines].join("\r\n");
}
