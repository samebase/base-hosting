import { describe, expect, test, vi } from "vite-plus/test";
import { registerHubClient, selectDeployment } from "./register-hub-client.ts";

function fakeConvex(initial: Record<string, string>) {
  const env = { ...initial };
  const calls: string[][] = [];
  const runConvex = async (args: string[]) => {
    calls.push(args);
    if (args[0] === "env" && args[1] === "get") {
      return { code: 0, stdout: `${env[args[2] ?? ""] ?? ""}\n` };
    }
    if (args[0] === "env" && args[1] === "set") {
      const separator = args.indexOf("--");
      env[args[separator + 1] ?? ""] = args[separator + 2] ?? "";
      return { code: 0, stdout: "" };
    }
    if (args[0] === "run") {
      return { code: 0, stdout: JSON.stringify("https://happy-otter-123.convex.site") };
    }
    throw new Error(`unexpected convex ${args.join(" ")}`);
  };
  return { env, calls, runConvex };
}

const hubEnv = {
  HUB_ISSUER: "https://auth.test/",
  HUB_REGISTRATION_TOKEN: "rt_token",
  HUB_CLIENT_NAME: "Starter",
};

describe("selectDeployment", () => {
  test("preview key, production flag, development", () => {
    expect(
      selectDeployment({ CONVEX_DEPLOY_KEY: "preview:abc", GITHUB_HEAD_REF: "feature" }, false),
    ).toEqual({ selectionArgs: ["--preview-name", "feature"], deploymentType: "preview" });
    expect(selectDeployment({}, true)).toEqual({
      selectionArgs: ["--prod"],
      deploymentType: "production",
    });
    expect(selectDeployment({}, false)).toEqual({
      selectionArgs: [],
      deploymentType: "development",
    });
    expect(selectDeployment({ CONVEX_DEPLOY_KEY: "prod:abc" }, false).deploymentType).toBe(
      "production",
    );
  });
});

describe("registerHubClient", () => {
  test("does nothing without the hub variables", async () => {
    const convex = fakeConvex({});
    expect(await registerHubClient({}, { runConvex: convex.runConvex })).toBeNull();
    expect(convex.calls).toEqual([]);
  });

  test("refuses half a configuration", async () => {
    await expect(registerHubClient({ HUB_ISSUER: "https://auth.test" })).rejects.toThrow(
      /together/,
    );
  });

  test("registers the deployment's callback once and stores the credentials", async () => {
    const convex = fakeConvex({});
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      expect(request.url).toBe("https://auth.test/register");
      expect(request.headers.get("authorization")).toBe("Bearer rt_token");
      const body = JSON.parse(await request.text());
      expect(body).toEqual({
        redirect_uris: ["https://happy-otter-123.convex.site/oauth/hub/callback"],
        client_name: "Starter preview",
        software_version: "happy-otter-123",
        deployment_type: "preview",
      });
      return Response.json({ client_id: "cl_1", client_secret: "s3cret" }, { status: 201 });
    });
    const registration = await registerHubClient(
      { ...hubEnv, CONVEX_DEPLOY_KEY: "preview:abc", GITHUB_HEAD_REF: "feature" },
      { runConvex: convex.runConvex, fetch: fetchSpy },
    );
    expect(registration).toEqual({
      clientId: "cl_1",
      clientSecret: "s3cret",
      callbackUrl: "https://happy-otter-123.convex.site/oauth/hub/callback",
    });
    expect(convex.env).toMatchObject({
      HUB_ISSUER: "https://auth.test",
      HUB_CLIENT_ID: "cl_1",
      HUB_CLIENT_SECRET: "s3cret",
    });
    expect(convex.calls[0]).toEqual(["env", "get", "HUB_CLIENT_ID", "--preview-name", "feature"]);

    // The second run finds the client id and stops.
    fetchSpy.mockClear();
    expect(
      await registerHubClient(
        { ...hubEnv, CONVEX_DEPLOY_KEY: "preview:abc", GITHUB_HEAD_REF: "feature" },
        { runConvex: convex.runConvex, fetch: fetchSpy },
      ),
    ).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("a refused registration is an error with the hub's reason", async () => {
    const convex = fakeConvex({});
    const fetchSpy = vi.fn(async () =>
      Response.json(
        { error: "invalid_redirect_uri", error_description: "host not allowed" },
        { status: 400 },
      ),
    );
    await expect(
      registerHubClient(hubEnv, { runConvex: convex.runConvex, fetch: fetchSpy, production: true }),
    ).rejects.toThrow(/400: invalid_redirect_uri host not allowed/);
    expect(convex.env["HUB_CLIENT_ID"]).toBeUndefined();
  });
});
