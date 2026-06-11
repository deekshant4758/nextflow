import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_aynpkitmssjglhbluaik",
  runtime: "node",
  dirs: ["./src/trigger"],
  logLevel: "info",
  maxDuration: 300,
});
