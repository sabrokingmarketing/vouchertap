-- In-app event registration.
--
-- Events can already link to an external form (events.form_url, e.g. a
-- Jotform). This adds the alternative: the built-in form, where members
-- give their name, email and how many will attend.
--
--   registration_enabled = true  -> in-app form; answers in event_registrations
--   registration_enabled = false -> external form_url if set, else nothing
--
-- Purely additive and idempotent: existing events default to false, so
-- nothing changes for them, and the script is safe to run more than once.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254 AND position('@' IN email) > 1),
  attendees INTEGER NOT NULL CHECK (attendees BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One registration per member per event; re-submitting updates it.
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_registrations_event_id_idx
  ON public.event_registrations (event_id);

DROP TRIGGER IF EXISTS update_event_registrations_updated_at ON public.event_registrations;
CREATE TRIGGER update_event_registrations_updated_at
  BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_registrations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_registrations TO authenticated;
GRANT ALL ON public.event_registrations TO service_role;

-- Members: only their own registration, and only for a published event
-- that has the in-app form switched on.
DROP POLICY IF EXISTS "Members view own registrations" ON public.event_registrations;
CREATE POLICY "Members view own registrations" ON public.event_registrations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members register for open events" ON public.event_registrations;
CREATE POLICY "Members register for open events" ON public.event_registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.is_published AND e.registration_enabled
    )
  );

DROP POLICY IF EXISTS "Members update own registration" ON public.event_registrations;
CREATE POLICY "Members update own registration" ON public.event_registrations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.is_published AND e.registration_enabled
    )
  );

DROP POLICY IF EXISTS "Members cancel own registration" ON public.event_registrations;
CREATE POLICY "Members cancel own registration" ON public.event_registrations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Admins: see and remove every registration.
DROP POLICY IF EXISTS "Admins view all registrations" ON public.event_registrations;
CREATE POLICY "Admins view all registrations" ON public.event_registrations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete registrations" ON public.event_registrations;
CREATE POLICY "Admins delete registrations" ON public.event_registrations
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Live updates for the admin registrations list.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_registrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_registrations;
  END IF;
END $$;
