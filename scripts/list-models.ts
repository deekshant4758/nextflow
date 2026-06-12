import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

async function main() {
  loadEnvFile(resolve(".env.local"));
  loadEnvFile(resolve(".env"));

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing from .env.local or .env");
  }

  const client = new GoogleGenerativeAI(apiKey);
  try {
    console.log("Listing available models...");
    // @ts-ignore
    const response = await client.listModels();
    console.log("\nModels returned:");
    for (const model of response.models) {
      console.log(`- ${model.name} (${model.displayName}): supports ${model.supportedGenerationMethods.join(", ")}`);
    }
  } catch (error) {
    console.error("Failed to list models:", error);
  }
}

void main();
