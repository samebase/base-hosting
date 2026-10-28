// Registers the selected Convex deployment as a client of the team's identity hub, once, and stores
// the client credentials on that deployment. Opt-in: without HUB_ISSUER and HUB_REGISTRATION_TOKEN
// in the environment it does nothing. The deploy scripts run it after the deployment exists; a
// preview deploy key selects the preview, `--prod` the production deployment, nothing the
// development deployment of this checkout. The registration token stays where the deploy key is:
// CI secrets or .env.local, never on a deployment.
/// <reference types="node" />
import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const CONVEX_CLI_PATH = fileURLToPath(
  new URL("../node_modules/convex/bin/main.js", import.meta.url),
);
const CALLBACK_PATH = "/oauth/hub/callback";

type RunResult = { code: number; stdout: string };
type RunConvex = (args: string[], options?: { sensitive?: boolean }) => Promise<RunResult>;

function runConvexCli(args: string[], options: { sensitive?: boolean } = {}) {
  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(process.execPath, [CONVEX_CLI_PATH, ...args], {
      env: process.env,
      stdio: ["ignore", "pipe", "inherit"],
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const result = { code: code ?? 1, stdout: Buffer.concat(chunks).toString("utf8") };
      if (result.code === 0) {
        resolve(result);
        return;
      }
      const label = options.sensitive ? "convex env set" : `convex ${args.join(" ")}`;
      reject(new Error(`${label} failed with exit code ${result.code}`));
    });
  });
}

export type Registration = {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
};

/** The deployment selection and type, from the same signals as scripts/ensure-convex-auth.ts. */
export function selectDeployment(env: NodeJS.ProcessEnv, production: boolean) {
  const deployKey = env["CONVEX_DEPLOY_KEY"];
  if (deployKey?.startsWith("preview:")) {
    const previewName = env["GITHUB_HEAD_REF"];
    if (!previewName) {
      throw new Error("A preview deploy key needs GITHUB_HEAD_REF, the name of its preview.");
    }
    return { selectionArgs: ["--preview-name", previewName], deploymentType: "preview" as const };
  }
  if (!deployKey && production) {
    return { selectionArgs: ["--prod"], deploymentType: "production" as const };
  }
  return {
    selectionArgs: [],
    deploymentType: deployKey ? ("production" as const) : ("development" as const),
  };
}

export async function registerHubClient(
  env: NodeJS.ProcessEnv,
  options: { runConvex?: RunConvex; fetch?: typeof fetch; production?: boolean } = {},
): Promise<Registration | null> {
  const runConvex = options.runConvex ?? runConvexCli;
  const fetchImpl = options.fetch ?? fetch;
  const issuer = env["HUB_ISSUER"]?.replace(/\/$/, "");
  const token = env["HUB_REGISTRATION_TOKEN"];
  if (!issuer && !token) {
    console.log("Hub registration skipped: HUB_ISSUER and HUB_REGISTRATION_TOKEN are not set.");
    return null;
  }
  if (!issuer || !token) {
    throw new Error("HUB_ISSUER and HUB_REGISTRATION_TOKEN must be set together.");
  }
  const { selectionArgs, deploymentType } = selectDeployment(env, options.production === true);

  const existing = await runConvex(["env", "get", "HUB_CLIENT_ID", ...selectionArgs]);
  if (existing.stdout.trim().length > 0) {
    console.log("Hub client already registered.");
    return null;
  }

  const siteResult = await runConvex([
    "run",
    "--inline-query",
    "process.env.CONVEX_SITE_URL",
    ...selectionArgs,
  ]);
  const siteUrl: unknown = JSON.parse(siteResult.stdout);
  if (typeof siteUrl !== "string") {
    throw new Error("Could not read CONVEX_SITE_URL of the selected deployment.");
  }
  const callbackUrl = `${siteUrl.replace(/\/$/, "")}${CALLBACK_PATH}`;
  const deploymentName = new URL(siteUrl).hostname.split(".")[0] ?? siteUrl;

  const response = await fetchImpl(`${issuer}/register`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      redirect_uris: [callbackUrl],
      client_name: `${env["HUB_CLIENT_NAME"] ?? "app"} ${deploymentType}`,
      software_version: deploymentName,
      deployment_type: deploymentType,
    }),
  });
  const body: unknown = await response.json();
  const record =
    typeof body === "object" && body !== null ? Object.fromEntries(Object.entries(body)) : {};
  if (
    response.status !== 201 ||
    typeof record["client_id"] !== "string" ||
    typeof record["client_secret"] !== "string"
  ) {
    throw new Error(
      `Hub registration failed with ${response.status}: ${String(record["error"] ?? "")} ${String(record["error_description"] ?? "")}`.trim(),
    );
  }
  await runConvex(["env", "set", ...selectionArgs, "--", "HUB_ISSUER", issuer], {
    sensitive: true,
  });
  await runConvex(["env", "set", ...selectionArgs, "--", "HUB_CLIENT_ID", record["client_id"]], {
    sensitive: true,
  });
  await runConvex(
    ["env", "set", ...selectionArgs, "--", "HUB_CLIENT_SECRET", record["client_secret"]],
    { sensitive: true },
  );
  console.log(`Hub client registered for ${callbackUrl}.`);
  return { clientId: record["client_id"], clientSecret: record["client_secret"], callbackUrl };
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  await registerHubClient(process.env, { production: process.argv.includes("--prod") });
}
