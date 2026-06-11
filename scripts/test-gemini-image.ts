import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

function inferMimeType(pathOrName: string) {
  const extension = pathOrName.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "jpg":
    case "jpeg":
    default:
      return "image/jpeg";
  }
}

function imageArgToPart(imageArg: string) {
  if (!imageArg) {
    return undefined;
  }

  if (imageArg.startsWith("data:image/")) {
    const match = imageArg.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return { text: `Invalid image data URL supplied: ${imageArg.slice(0, 48)}...` };
    }

    return {
      inlineData: {
        mimeType: match[1],
        data: match[2],
      },
    };
  }

  const resolvedPath = resolve(imageArg);
  if (existsSync(resolvedPath)) {
    const file = readFileSync(resolvedPath);
    return {
      inlineData: {
        mimeType: inferMimeType(resolvedPath),
        data: file.toString("base64"),
      },
    };
  }

  return {
    text: `Reference image URL: ${imageArg}`,
  };
}

function buildRequestBody(prompt: string, system: string, imageArgs: string[]) {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  if (system.trim()) {
    parts.push({ text: `Style guidance: ${system.trim()}` });
  }

  parts.push({ text: prompt });

  for (const imageArg of imageArgs) {
    const part = imageArgToPart(imageArg);
    if (part) {
      parts.push(part);
    }
  }

  return {
    contents: [
      {
        role: "user",
        parts,
      },
    ],
  };
}

function ensureOutputDir() {
  const outputDir = resolve(".tmp", "gemini-image-debug");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

async function main() {
  loadEnvFile(resolve(".env.local"));
  loadEnvFile(resolve(".env"));

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing from .env.local or .env");
  }

  const modelName = readArg("model", "gemini-3.1-flash-image-preview");
  const prompt = readArg("prompt", "Create a cinematic Ghibli-inspired landscape with warm light.");
  const system = readArg("system", "");
  const outputName = readArg("out", "gemini-image-debug");
  const imageArgs = process.argv
    .filter((arg) => arg.startsWith("--image="))
    .map((arg) => arg.slice("--image=".length))
    .filter(Boolean);

  console.log(`Testing Gemini image model: ${modelName}`);
  console.log(`System prompt: ${system ? "yes" : "no"}`);
  console.log(`Reference images: ${imageArgs.length}`);
  console.log(`Prompt: ${prompt}`);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildRequestBody(prompt, system, imageArgs)),
    },
  );

  const responseText = await response.text();

  console.log(`\nHTTP ${response.status} ${response.statusText}`);

  if (!response.ok) {
    console.error("\nGemini image request failed.\n");
    console.error(responseText);
    process.exitCode = 1;
    return;
  }

  const json = JSON.parse(responseText) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: {
            mimeType?: string;
            data?: string;
          };
        }>;
      };
      finishReason?: string;
      finishMessage?: string;
    }>;
    promptFeedback?: unknown;
    usageMetadata?: unknown;
  };

  console.log("\nTop-level fields:");
  console.log(JSON.stringify(
    {
      candidateCount: json.candidates?.length ?? 0,
      promptFeedback: json.promptFeedback ?? null,
      usageMetadata: json.usageMetadata ?? null,
    },
    null,
    2,
  ));

  const outputDir = ensureOutputDir();
  let imageCount = 0;

  for (const [candidateIndex, candidate] of (json.candidates ?? []).entries()) {
    console.log(`\nCandidate ${candidateIndex + 1}:`);
    console.log(`finishReason: ${candidate.finishReason ?? "unknown"}`);
    if (candidate.finishMessage) {
      console.log(`finishMessage: ${candidate.finishMessage}`);
    }

    for (const [partIndex, part] of (candidate.content?.parts ?? []).entries()) {
      if (part.text) {
        console.log(`part ${partIndex + 1} text:\n${part.text}\n`);
      }

      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("image/")) {
        imageCount += 1;
        const extension = part.inlineData.mimeType.split("/")[1] ?? "png";
        const filePath = resolve(outputDir, `${outputName}-${candidateIndex + 1}-${imageCount}.${extension}`);
        writeFileSync(filePath, Buffer.from(part.inlineData.data, "base64"));
        console.log(`part ${partIndex + 1} image saved: ${filePath}`);
      }
    }
  }

  if (imageCount === 0) {
    console.log("\nNo image parts were returned.");
  }
}

void main().catch((error) => {
  console.error("\nGemini image debug script failed.\n");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
