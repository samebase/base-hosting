# Sign in through an identity hub

An [identity hub](https://github.com/samebase/identity-hub) is one Convex deployment that holds a
team's GitHub, Google and email connections and signs users in to all its apps. This starter can
be one of those apps: each deployment registers itself with the hub at deploy time, so previews get
GitHub sign-in without a GitHub app of their own.

The hub is optional. Without `HUB_ISSUER` and `HUB_REGISTRATION_TOKEN` in the environment, the
deploy scripts skip registration and nothing below is needed.

## 1. Register the app at the hub

On the hub:

```sh
npx convex run --prod identityBroker:createApp '{"name":"My app","firstParty":true,"allowedCallbackHosts":["*.convex.site","127.0.0.1"]}'
npx convex run --prod identityBroker:mintRegistrationToken '{"appId":"my-app-ab12c"}'
```

Store the token as the `HUB_REGISTRATION_TOKEN` secret of this repository and `HUB_ISSUER` as a
variable, next to the deploy keys. Locally, put both in `.env.local`. The token never goes on a
deployment: `scripts/register-hub-client.ts` reads it, registers the deployment's callback, and
stores only the resulting `HUB_CLIENT_ID` and `HUB_CLIENT_SECRET` on that deployment.

## 2. Mount the hub as a sign-in method

`convex/convex.config.ts`: declare the variables and install the generic OAuth component of Convex
Auth once, under the `/oauth/hub` prefix. The component needs them on every deployment, which the
registration script guarantees.

```ts
import oauth from "@convex-dev/auth/components/oauth/convex.config";

const app = defineApp({
  env: {
    AUTH_PRIVATE_KEY: v.string(),
    AUTH_JWKS: v.string(),
    HUB_ISSUER: v.string(),
    HUB_CLIENT_ID: v.string(),
    HUB_CLIENT_SECRET: v.string(),
  },
});
app.use(oauth, {
  name: "authHub",
  httpPrefix: "/oauth/hub",
  env: { CLIENT_ID: app.env.HUB_CLIENT_ID, CLIENT_SECRET: app.env.HUB_CLIENT_SECRET },
});
```

`convex/auth.ts`: the hub is a plain OpenID Provider, so the catalog is three URLs and a mapping
from the `id_token` claims. `sub` is pairwise per app: stable for this app, different elsewhere.

```ts
import { setupOauth } from "@convex-dev/auth/methods/oauth/server";
import { env } from "./_generated/server";

export const { startSignIn: startSignInWithHub, completeSignIn: completeSignInWithHub } =
  setupOauth(
    auth,
    "hub",
    {
      authorizationEndpoint: `${env.HUB_ISSUER}/authorize`,
      tokenEndpoint: `${env.HUB_ISSUER}/token`,
      issuer: env.HUB_ISSUER,
      scopes: ["openid", "email", "profile"],
      profile: (claims) => ({
        id: claims.sub,
        email: typeof claims.email === "string" ? claims.email : undefined,
        name: typeof claims.name === "string" ? claims.name : undefined,
      }),
    },
    { createUser: internal.users.createUser, onSignIn: internal.users.onSignIn },
    { component: components.authHub, allowedRedirectOrigins: [env.SITE_URL] },
  );
```

`createUser` receives `{ provider: { name: "hub", accountId, profile } }`: `accountId` is the hub
subject. Create the `users` row from the profile the first time and return its id.

## 3. Add the button

```tsx
import { useOauthSignIn } from "@convex-dev/auth/methods/oauth/react";

const { signIn } = useOauthSignIn({
  start: api.auth.startSignInWithHub,
  complete: api.auth.completeSignInWithHub,
});
<button onClick={() => signIn({ redirectTo: window.location.origin })}>Sign in</button>;
```

The hub shows its own chooser, or goes straight to the one connector it has. Add `connector=github`
to the authorization request to skip the chooser for a first-party app.
