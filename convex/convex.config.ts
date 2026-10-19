import { defineApp } from "convex/server";
import { v } from "convex/values";
import auth from "@convex-dev/auth/convex.config";
import anonymous from "@convex-dev/auth/components/anonymous/convex.config";
import hosting from "@samebase/convex-hosting/convex.config";

// A push fails while either variable is missing on the deployment. scripts/ensure-convex-auth.ts
// creates them before the first push.
const app = defineApp({
  env: { AUTH_PRIVATE_KEY: v.string(), AUTH_JWKS: v.string() },
});
app.use(auth, {
  httpPrefix: "/auth",
  env: { AUTH_PRIVATE_KEY: app.env.AUTH_PRIVATE_KEY, AUTH_JWKS: app.env.AUTH_JWKS },
});
app.use(anonymous);
app.use(hosting);

export default app;
