import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";

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

function imageArgToPart(imageArg: string): Part | undefined {
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
    const extension = resolvedPath.split(".").pop()?.toLowerCase();
    const mimeType =
      extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : extension === "gif"
            ? "image/gif"
            : "image/jpeg";

    return {
      inlineData: {
        mimeType,
        data: file.toString("base64"),
      },
    };
  }

  return {
    text: `Image URL: ${imageArg}`,
  };
}

async function main() {
  loadEnvFile(resolve(".env.local"));
  loadEnvFile(resolve(".env"));

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing from .env.local or .env");
  }

  const modelName = readArg("model", "gemini-2.5-flash-lite");
  const systemPrompt = readArg("system", "");
  const userPrompt = readArg("prompt", "Describe this input briefly.");
  const imageArg = readArg("image", "");

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: modelName });
  const imagePart = imageArgToPart(imageArg);
  const parts: Part[] = [{ text: userPrompt }];

  if (imagePart) {
    parts.push(imagePart);
  }

  console.log(`Testing Gemini model: ${modelName}`);
  console.log(`System prompt: ${systemPrompt ? "yes" : "no"}`);
  console.log(`Image input: ${imageArg ? "yes" : "no"}`);

  try {
    const result = await model.generateContent({
      systemInstruction: systemPrompt || undefined,
      contents: [{ role: "user", parts }],
    });

    console.log("\nResponse:\n");
    console.log(result.response.text());
  } catch (error) {
    console.error("\nGemini request failed.\n");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

void main();
