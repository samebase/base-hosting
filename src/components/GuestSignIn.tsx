import { useSignInAnonymously } from "@convex-dev/auth/methods/anonymous/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { Button } from "#components/ui/button";

/** Starts a guest session. With `next`, a document load then opens that page as the guest. */
export function GuestSignIn({ next }: { next?: string }) {
  const { signIn } = useSignInAnonymously(api.auth);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  const continueAsGuest = () => {
    setError("");
    setIsPending(true);
    void signIn()
      .then(() => {
        // The provider confirms the session after sign-in resolves, so a navigation inside the
        // app could reach a gate first. The server renders the next page from the new cookie.
        if (next) {
          location.assign(next);
        }
      })
      .catch((signInError: unknown) => {
        setError(signInError instanceof Error ? signInError.message : "Could not start session");
      })
      .finally(() => setIsPending(false));
  };

  return (
    <>
      <Button type="button" disabled={isPending} onClick={continueAsGuest}>
        {isPending ? "Starting" : "Continue as guest"}
      </Button>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
