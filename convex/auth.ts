import { setupConvexAuth } from "@convex-dev/auth/server";
import { setupAnonymous } from "@convex-dev/auth/methods/anonymous/server";
import { components, internal } from "./_generated/api";

const auth = setupConvexAuth({ component: components.auth });
export const { signOut, refreshSession } = auth;

export const { signInAnonymously } = setupAnonymous(auth, {
  component: components.authAnonymous,
}).attachUserCallbacks({ createUser: internal.guests.createUser });
