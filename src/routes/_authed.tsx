import {
  RedirectWithoutSession,
  redirectWithoutSession,
} from "@samebase/convex-hosting-tanstack-start/convex-auth";
import { createFileRoute, Outlet } from "@tanstack/react-router";

/** The pages under `_authed/` need a session: without one, they redirect to /signin. */
export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ serverContext }) => redirectWithoutSession(serverContext, { to: "/signin" }),
  component: () => (
    <RedirectWithoutSession to="/signin">
      <Outlet />
    </RedirectWithoutSession>
  ),
});
