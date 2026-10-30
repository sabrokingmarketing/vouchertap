-- Pinned events + POPIA consent.
--
-- Purely additive and idempotent: both columns default to "off", so existing
-- events stay unpinned and every existing member is asked for POPIA consent
-- once, the next time they open the app. Safe to run more than once.
--
-- No policy changes are needed:
--   * events: "Admins manage events" already lets admins set is_pinned, and
--     members can only read published events.
--   * profiles: "Users can update own profile" / "Users can insert own
--     profile" let a member record their own consent and nobody else's.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- When the member accepted the POPIA notice. NULL = not yet accepted.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS popia_accepted_at TIMESTAMPTZ;
