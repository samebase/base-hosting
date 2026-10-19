import { convexQuery } from "@convex-dev/react-query";
import { useSignOutSession } from "@samebase/convex-hosting-tanstack-start/convex-auth";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button } from "#components/ui/button";

export const Route = createFileRoute("/_authed/account")({
  // On the server, the query runs with the token of the session cookie.
  loader: async ({ context }) => {
    // @ts-expect-error convexQuery always sets queryFn, but its type allows undefined there, which `query` rejects under exactOptionalPropertyTypes.
    await context.queryClient.query(convexQuery(api.guests.viewer, {}));
  },
  component: AccountPage,
});

function AccountPage() {
  const {
    data: { name },
  } = useSuspenseQuery(convexQuery(api.guests.viewer, {}));
  const signOut = useSignOutSession("/auth/signout");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  const onSignOut = async () => {
    setSignOutFailed(false);
    setIsSigningOut(true);
    // A successful sign-out reloads the page, so only a failure comes back here.
    if (!(await signOut())) {
      setSignOutFailed(true);
      setIsSigningOut(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-3 p-4">
      <h1 className="text-lg">Account</h1>
      <p>Signed in as {name}</p>
      <Button type="button" variant="outline" disabled={isSigningOut} onClick={onSignOut}>
        {isSigningOut ? "Signing out" : "Sign out"}
      </Button>
      {signOutFailed ? (
        <p className="text-destructive text-sm" role="alert">
          Sign-out failed. Try again.
        </p>
      ) : null}
    </main>
  );
}
