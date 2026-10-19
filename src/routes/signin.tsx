import { createFileRoute } from "@tanstack/react-router";
import { GuestSignIn } from "#components/GuestSignIn";

export const Route = createFileRoute("/signin")({
  component: SignInPage,
});

function SignInPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-3 p-4">
      <h1 className="text-lg">Sign in</h1>
      <GuestSignIn next="/account" />
    </main>
  );
}
