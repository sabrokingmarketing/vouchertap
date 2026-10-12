import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, Loader2, Pin, Clock, ExternalLink, PlayCircle } from "lucide-react";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { SmartImage } from "@/components/smart-image";
import { InAppRegistration } from "@/components/event-registration";
import { useMyEventRegistrations } from "@/hooks/use-event-registrations";
import { registrationModeOf } from "@/lib/event-registration";

// Pinned SLK Breakfast card cover (public/breakfast-cover.jpg).
const BREAKFAST_COVER = "/breakfast-cover.jpg";

function isRsvpEvent(title: string | null | undefined) {
  return !!title && title.toLowerCase().includes("slk breakfast");
}

function nextBiweeklyFriday() {
  const now = new Date();
  const d = new Date(now);
  d.setHours(7, 30, 0, 0);
  const day = d.getDay();
  let diff = (5 - day + 7) % 7;
  if (diff === 0 && now.getTime() > d.getTime()) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export const Route = createFileRoute("/app/events")({
  component: EventsPage,
});

function PinnedBreakfastCard() {
  const date = nextBiweeklyFriday();
  return (
    <Card className="group overflow-hidden border-border/60 bg-card rounded-2xl shadow-lg shadow-black/[0.04] ring-1 ring-black/[0.02] hover:shadow-xl hover:shadow-black/[0.08] hover:-translate-y-1 hover:border-primary/40 transition-all duration-300 ease-out h-full flex flex-col">
      <div className="relative">
        <SmartImage
          src={BREAKFAST_COVER}
          alt="SLK Breakfast Meeting"
          wrapperClassName="aspect-[16/10]"
          className="transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <Badge className="absolute top-3 left-3 gap-1 bg-background/90 text-foreground backdrop-blur-sm border border-border/50 shadow-sm font-medium">
          <Pin className="size-3 text-primary" /> Pinned
        </Badge>
      </div>
      <div className="p-6 flex-1 flex flex-col gap-4">
        <h2 className="text-xl font-semibold leading-snug tracking-tight">SLK Breakfast Meeting</h2>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          Connect, hear from inspiring speakers, and share a meal with the SLK community every
          second Friday morning.
        </p>
        <div className="mt-1 space-y-2.5 text-sm">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center size-7 rounded-lg bg-primary/10 text-primary shrink-0">
              <Clock className="size-3.5" />
            </span>
            <span className="font-medium text-foreground">07:30</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center size-7 rounded-lg bg-primary/10 text-primary shrink-0">
              <CalendarDays className="size-3.5" />
            </span>
            <span className="font-medium text-foreground">
              {date.toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center size-7 rounded-lg bg-primary/10 text-primary shrink-0">
              <MapPin className="size-3.5" />
            </span>
            <span className="font-medium text-foreground">Bella Vista Wedding Venue</span>
          </div>
        </div>
        <Button asChild className="w-full mt-auto rounded-xl h-12 font-semibold">
          <Link to="/app/breakfast">View details & RSVP</Link>
        </Button>
      </div>
    </Card>
  );
}

function EventsPage() {
  useRealtimeInvalidate("events", [["events"]]);
  const { data: myRegistrations } = useMyEventRegistrations();

  const { data, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("is_published", true)
        .gte("starts_at", new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString())
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-border pb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary font-semibold">
            So Love Krugersdorp
          </p>
          <h1 className="text-3xl md:text-5xl font-bold mt-3 tracking-tight">Upcoming events</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-3 max-w-xl">
            What's happening soon at SLK — gatherings, breakfasts and exclusive member experiences.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-4 text-primary" />
          {data?.length ?? 0} event{(data?.length ?? 0) === 1 ? "" : "s"} ahead
        </div>
      </header>

      {isLoading ? (
        <div className="py-10 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ul className="grid gap-6 md:gap-8 md:grid-cols-2 xl:grid-cols-3">
          <li className="animate-rise">
            <PinnedBreakfastCard />
          </li>
          {(data ?? [])
            .filter((e) => !isRsvpEvent(e.title))
            .map((event, i) => {
              const mode = registrationModeOf(event);
              return (
                <li
                  key={event.id}
                  className="animate-rise"
                  style={{ animationDelay: `${Math.min(i + 1, 8) * 60}ms` }}
                >
                  <Card className="group overflow-hidden border-border/60 bg-card rounded-2xl shadow-lg shadow-black/[0.04] ring-1 ring-black/[0.02] hover:shadow-xl hover:shadow-black/[0.08] hover:-translate-y-1 hover:border-primary/40 transition-all duration-300 ease-out h-full flex flex-col">
                    {event.image_url && (
                      <SmartImage
                        src={event.image_url}
                        alt={event.title}
                        wrapperClassName="aspect-[16/10]"
                        className="transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    )}
                    <div className="p-6 flex-1 flex flex-col gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-primary font-semibold">
                          {new Date(event.starts_at).toLocaleDateString(undefined, {
                            weekday: "long",
                          })}
                        </p>
                        <h2 className="text-xl font-semibold leading-snug mt-2 tracking-tight">
                          {event.title}
                        </h2>
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                          {event.description}
                        </p>
                      )}
                      <div className="mt-1 space-y-2.5 text-sm">
                        <div className="flex items-center gap-2.5">
                          <span className="grid place-items-center size-7 rounded-lg bg-primary/10 text-primary shrink-0">
                            <Clock className="size-3.5" />
                          </span>
                          <span className="font-medium text-foreground">
                            {new Date(event.starts_at).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="grid place-items-center size-7 rounded-lg bg-primary/10 text-primary shrink-0">
                            <CalendarDays className="size-3.5" />
                          </span>
                          <span className="font-medium text-foreground">
                            {new Date(event.starts_at).toLocaleDateString(undefined, {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })}
                          </span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2.5">
                            <span className="grid place-items-center size-7 rounded-lg bg-primary/10 text-primary shrink-0">
                              <MapPin className="size-3.5" />
                            </span>
                            <span className="font-medium text-foreground">{event.location}</span>
                          </div>
                        )}
                      </div>
                      {(mode !== "none" || event.video_url) && (
                        // Wrapper carries mt-auto so the group pins to the card
                        // bottom and cards stay aligned however many links exist.
                        <div className="mt-auto flex flex-col gap-2">
                          {mode === "form" && (
                            <InAppRegistration
                              event={event}
                              registration={myRegistrations?.[event.id]}
                            />
                          )}
                          {mode === "link" && event.form_url && (
                            <Button asChild className="w-full rounded-xl h-12 font-semibold">
                              <a href={event.form_url} target="_blank" rel="noopener noreferrer">
                                Register
                                <ExternalLink className="size-4 ml-1.5" />
                              </a>
                            </Button>
                          )}
                          {event.video_url && (
                            // Secondary only when Register is also present, so the
                            // sign-up stays the clear primary action.
                            <Button
                              asChild
                              variant={mode !== "none" ? "outline" : "default"}
                              className="w-full rounded-xl h-12 font-semibold"
                            >
                              <a href={event.video_url} target="_blank" rel="noopener noreferrer">
                                <PlayCircle className="size-4 mr-1.5" />
                                Watch Video
                              </a>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="p-8 text-center border-dashed">
      <CalendarDays className="size-8 mx-auto text-muted-foreground" />
      <p className="font-semibold mt-3">No upcoming events yet</p>
      <p className="text-sm text-muted-foreground mt-1">
        Check back soon for what's happening at SLK.
      </p>
    </Card>
  );
}
