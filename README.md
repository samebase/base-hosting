# Samebase app

A small, complete app base: guest sign-in, real-time data, sharing, and deploys, without services
that a new app might not need.

The Convex deployment runs the backend and also serves the app's files through
[convex-hosting](https://github.com/samebase/convex-hosting). One Convex project is the whole
stack: one deployment, one URL, and one deploy key. The same app on Cloudflare Workers is
[samebase/base](https://github.com/samebase/base).

## Stack

- React 19 and TanStack Start in SPA mode
- Convex for the real-time backend, database, and guest authentication
- convex-hosting for delivery from the Convex deployment, with Cloudflare's rules for the files
- shadcn/ui primitives for the user interface
- Vite+ for development, formatting, linting, tests, and builds
- Node.js 24 for application and automation code

The example app is a public todo list. Guests can sign in without an external identity provider,
create todos, see real-time updates, and scan a QR code to open the same list on another device.

## Start

1. Select **Use this template** and create your repository.
2. Clone it, then install Vite+ and the dependencies as described in
   [Local development](#local-development).
3. Run `pnpm run dev`. Convex asks you to sign in and creates a project with its development
   deployment. On a fresh clone, the first push fails until the first deploy; see
   [First run](#first-run).
4. Store the project's production deploy key as the repository secret `CONVEX_DEPLOY_KEY`. With the
   [GitHub CLI](https://cli.github.com/), this keeps the key off the screen:

   ```sh
   key=$(npx convex deployment token create "<repository> deploy.yml" --prod) && printf '%s' "$key" | gh secret set CONVEX_DEPLOY_KEY
   ```

   On Windows PowerShell:

   ```powershell
   $key = npx convex deployment token create "<repository> deploy.yml" --prod; if ($LASTEXITCODE -eq 0) { $key | gh secret set CONVEX_DEPLOY_KEY }
   ```

5. Push to `main`, or re-run the failed `deploy.yml` run on the Actions tab. The run's summary shows
   the site URL, `https://<deployment>.convex.site`.

Without a terminal, generate the production deploy key in the
[Convex dashboard](https://dashboard.convex.dev/) (the production deployment, **Settings**,
**General**, **Deploy keys**) and add it as a repository secret under **Settings**, **Secrets and
variables**, **Actions**.

Optional previews: store the project's preview deploy key (Convex dashboard, project settings,
**Preview deploy keys**) as the repository secret `CONVEX_PREVIEW_DEPLOY_KEY`, not as a secret of
the `preview` environment, because the cleanup job runs outside that environment. Each pull request
then deploys to a preview
named after its branch, and closing the pull request deletes it. Without the key, pull requests
deploy nothing.

## Local development

Install [Vite+](https://viteplus.dev/guide/) and use it to supply the Node.js version in
`.node-version`. Run `corepack enable` once to make the pinned pnpm version available.

```sh
corepack enable
pnpm install
pnpm run dev
```

The development command starts Convex and TanStack Start together. It also creates missing Convex
Auth JWT keys in the development deployment. In a linked Git worktree, the same command
automatically uses an isolated local backend. Convex writes `VITE_CONVEX_URL` to `.env.local`; do
not set it manually.

To force the isolated backend outside a linked worktree, use:

```sh
pnpm run dev:worktree
```

### First run

On a fresh clone, the first push of `pnpm run dev` fails: `convex/http.ts` imports
`.convex-hosting/version.js`, which only a deploy writes. Keep `pnpm run dev` running and run this
in a second terminal:

```sh
pnpm run deploy:dev
```

It builds the app, uploads the files to the development deployment, writes the version file, and
pushes. Then stop `pnpm run dev` and start it again; it works as usual from then on.

The core workflow runs on macOS, Linux, and Windows. See
[`docs/local-setup.md`](./docs/local-setup.md) for the local Convex setup and troubleshooting steps.

## Checks, builds, and deploys

| Command               | Purpose                                                           |
| --------------------- | ----------------------------------------------------------------- |
| `pnpm run check`      | Format, lint, type-check, test, and verify generated redirects    |
| `pnpm run build`      | Run the checks and build the app into `dist/client`               |
| `pnpm run deploy:dev` | Build, upload, and push to the development deployment             |
| `pnpm run deploy`     | Build, upload, and push to production, or to the key's deployment |

## Deployment contract

`.github/workflows/deploy.yml` deploys each push to `main` with
[`samebase/convex-hosting/actions/deploy`](https://github.com/samebase/convex-hosting/blob/main/docs/deploy.md#github-actions)
and `CONVEX_DEPLOY_KEY`. `.github/workflows/preview.yml` deploys each pull request with
`actions/preview` and `CONVEX_PREVIEW_DEPLOY_KEY`, and `actions/cleanup` deletes the preview when
the pull request closes. Both actions run the `deploy` package script. Keep its name, and keep the
`convex-hosting deploy` command at its end, because `actions/preview` appends `--preview-name`.

`pnpm run deploy` runs `npx convex deploy` with the checks, the build, and the upload as its
`--cmd`, so a failed check stops the release before the push switches the site. Inside that build,
`scripts/ensure-convex-auth.ts` creates the Convex Auth keys on a new deployment or preview and
keeps existing keys; it stops the deploy when the deployment it selects is not the one that the
deploy targets. Deploy with `pnpm run deploy`, never with a plain `npx convex deploy`: a plain
push serves the files of the last deploy from this checkout, often another deployment's.

The files follow Cloudflare's static asset rules: `public/_redirects` maps `/` and `/about` to their
prerendered pages, and every other path gets the SPA shell (`--not-found-handling
single-page-application`). See the
[convex-hosting documentation](https://github.com/samebase/convex-hosting#documentation) for custom
domains, headers, and the deploy options.

## Important files

- `package.json` defines the supported development, check, build, and deploy commands.
- `prerender.config.ts` defines the public pages shared by TanStack Start and `public/_redirects`.
- `vite.config.ts` defines the TanStack Start SPA and prerender behavior.
- `convex/convex.config.ts` mounts the convex-hosting component, and `convex/http.ts` routes every
  path that the auth routes do not answer to the site.
- `.github/workflows/deploy.yml` and `.github/workflows/preview.yml` deploy production and previews.
- `convex/` contains the backend, schema, authentication, and generated Convex bindings.
- `src/` contains the React application and routes.

## Generated and managed files

- `src/routeTree.gen.ts` is generated by TanStack Router.
- `convex/_generated/api.*`, `dataModel.d.ts`, and `server.*` are generated by Convex.
- `.convex-hosting/` is written by each deploy and ignores itself. Do not commit it.
- `convex/_generated/ai/`, `.agents/skills/`, `skills-lock.json`, and the marked Convex sections in
  `AGENTS.md` and `CLAUDE.md` are managed by `npx convex ai-files install`.
- The marked Vite+ section in `AGENTS.md` is generated by `vp config`. The package `prepare`
  command uses `--no-agent`, so installs do not rewrite it.
- `scripts/generate-cloudflare-redirects.ts` owns only the marked generated block in
  `public/_redirects`. Custom redirect rules can stay outside that block.

Do not hand-edit generated files when their source tool can update them.
When a Convex AI-file update changes the installed source snapshot, confirm its distribution license
and update `THIRD_PARTY_NOTICES.md` when its third-party material changes.

## License

Licensed under the [Apache License 2.0](./LICENSE). See
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for included third-party material.
