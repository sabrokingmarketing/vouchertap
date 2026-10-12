import { createFileRoute, redirect } from "@tanstack/react-router";

// The members access code has been retired. This route stays only so old
// bookmarks, shared links and installed home-screen shortcuts still land
// somewhere sensible instead of a 404.
export const Route = createFileRoute("/access-code")({
  beforeLoad: () => {
    throw redirect({ to: "/login", replace: true });
  },
});
