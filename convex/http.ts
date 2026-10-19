import { httpRouter } from "convex/server";
import { routeAll } from "@samebase/convex-hosting";
import { components } from "./_generated/api";
import { versionId } from "../.convex-hosting/version.js";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// The site answers every path that the Convex Auth routes above do not: a file of the build, else
// the single-page shell. `pnpm run deploy` writes .convex-hosting/version.js.
routeAll(http, components.hosting, versionId);

export default http;
