import { NextResponse } from "next/server";
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { z } from "zod";

const schema = z.object({
  model: z.string().default("gemini-2.5-flash"),
  prompt: z.string().min(1),
  systemPrompt: z.string().optional(),
  imageInput: z.string().optional(),
});

const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

function imageToPart(image: string): Part {
  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    return { inlineData: { mimeType: match[1], data: match[2] } };
  }
  return { text: `Image URL: ${image}` };
}

function cleanGeminiError(message: string): string {
  const normalized = message.toLowerCase();
  
  if (normalized.includes("quota") || message.includes("429")) {
    return "Quota exceeded. Please check your Gemini API billing details or try again later.";
  }
  
  if (normalized.includes("api key") || message.includes("403") || normalized.includes("unauthorized") || normalized.includes("key not valid")) {
    return "Gemini API key is invalid or not configured. Please check your environment variables.";
  }

  if (message.includes("404") || normalized.includes("not found") || normalized.includes("not supported")) {
    return "The requested Gemini model is not supported or not found.";
  }

  // Remove the URL and API endpoints from the message to avoid showing raw stack/URLs
  let clean = message.replace(/https:\/\/generativelanguage\.googleapis\.com[^\s]*/g, "Gemini API");
  
  // Strip the prefix if it starts with [GoogleGenerativeAI Error]:
  clean = clean.replace(/^\[GoogleGenerativeAI Error\]:\s*/i, "");
  
  // Extract content in brackets or after colons to get the final message if possible
  const match = clean.match(/\[\d+\s+[^\]]+\]\s*(.*)$/);
  if (match && match[1]) {
    return match[1].trim();
  }

  const parts = clean.split(":");
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim();
    if (lastPart.length > 5 && !lastPart.includes("GoogleGenerativeAI")) {
      return lastPart;
    }
  }

  return clean;
}

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured.",
      },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.message },
      { status: 400 }
    );
  }

  const { model, prompt, systemPrompt, imageInput } = parsed.data;
  const client = new GoogleGenerativeAI(apiKey);

  const parts: Part[] = [{ text: prompt }];
  if (imageInput) {
    parts.push(imageToPart(imageInput));
  }

  // Try requested model first, then fallbacks
  const models = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let lastErrorMsg = "";

  for (const modelName of models) {
    try {
      const genModel = client.getGenerativeModel({ model: modelName });
      const result = await genModel.generateContent({
        systemInstruction: systemPrompt || undefined,
        contents: [{ role: "user", parts }],
      });

      const text = result.response.text();

      return NextResponse.json({
        ok: true,
        output: text,
        model: modelName,
        fallback: modelName !== model ? modelName : undefined,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      const normalized = message.toLowerCase();
      
      const isQuota =
        message.includes("429") || normalized.includes("quota");
      const isCapacity =
        message.includes("503") ||
        normalized.includes("high demand") ||
        normalized.includes("service unavailable");
      const isNotFound =
        message.includes("404") ||
        normalized.includes("not found") ||
        normalized.includes("not supported");

      lastErrorMsg = message;

      if (isQuota) {
        return NextResponse.json(
          {
            ok: false,
            error: "Gemini quota exceeded. Try again later or switch models.",
            quota: true,
          },
          { status: 429 }
        );
      }

      if (isCapacity || isNotFound) {
        // Try next model
        continue;
      }

      const cleanMsg = cleanGeminiError(message);
      return NextResponse.json(
        { ok: false, error: cleanMsg },
        { status: 500 }
      );
    }
  }

  const cleanLastMsg = lastErrorMsg ? cleanGeminiError(lastErrorMsg) : "All Gemini models are temporarily unavailable. Try again later.";
  return NextResponse.json(
    {
      ok: false,
      error: cleanLastMsg,
    },
    { status: 503 }
  );
}

