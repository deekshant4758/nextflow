import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { configure, runs, tasks } from "@trigger.dev/sdk/v3";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function readArg(flag: string, fallback = "") {
  const match = process.argv.find((arg) => arg.startsWith(`--${flag}=`));
  return match ? match.slice(flag.length + 3) : fallback;
}

async function main() {
  loadEnvFile(resolve(".env.local"));
  loadEnvFile(resolve(".env"));

  const triggerSecretKey = process.env.TRIGGER_SECRET_KEY;
  if (!triggerSecretKey) {
    throw new Error("TRIGGER_SECRET_KEY is missing from .env.local or .env");
  }

  const videoUrl = readArg("video", "https://www.w3schools.com/html/mov_bbb.mp4");
  const timestamp = readArg("timestamp", "1.2");

  configure({
    accessToken: triggerSecretKey,
  });

  console.log("Trigger task: extract-frame-node");
  console.log(`Video URL: ${videoUrl}`);
  console.log(`Timestamp: ${timestamp}`);

  const handle = await tasks.trigger(
    "extract-frame-node",
    {
      videoUrl,
      timestamp,
    },
    {
      tags: ["nextflow", "debug", "extract-frame"],
    },
  );

  console.log(`Run ID: ${handle.id}`);
  console.log("Waiting for completion...");

  const run = await runs.poll(handle.id, { pollIntervalMs: 1000 });

  console.log("\nRun status:");
  console.log(run.status);

  if (run.status !== "COMPLETED") {
    console.log("\nRun error:");
    console.log(JSON.stringify(run.error ?? null, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log("\nRaw output:");
  console.log(JSON.stringify(run.output ?? null, null, 2));

  const outputValue =
    typeof run.output === "object" && run.output && "output" in run.output
      ? (run.output as { output?: unknown }).output
      : run.output;

  console.log("\nResolved output value:");
  console.log(typeof outputValue === "string" ? outputValue : JSON.stringify(outputValue, null, 2));
}

void main().catch((error) => {
  console.error("\nExtract frame debug script failed.\n");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
