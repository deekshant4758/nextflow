import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { task } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { env } from "@/lib/env";

const llmPayloadSchema = z.object({
  model: z.string(),
  systemPrompt: z.string().optional(),
  userMessage: z.string(),
  images: z.array(z.string()).default([]),
});

const fallbackLlmModels = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3-flash", "gemma-3-27b-it"];

function imageToPart(image: string, index: number): Part {
  const dataUrlMatch = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (dataUrlMatch) {
    return {
      inlineData: {
        mimeType: dataUrlMatch[1],
        data: dataUrlMatch[2],
      },
    };
  }

  return {
    text: `Image ${index + 1} URL: ${image}`,
  };
}

function buildQuotaFallback(parsed: z.infer<typeof llmPayloadSchema>) {
  const trimmedPrompt = parsed.userMessage.trim();
  const promptPreview = trimmedPrompt.length > 160 ? `${trimmedPrompt.slice(0, 157)}...` : trimmedPrompt;
  const imageContext = parsed.images.length ? ` with ${parsed.images.length} image input${parsed.images.length > 1 ? "s" : ""}` : "";

  return `Gemini quota is currently exceeded, so this run used a local fallback instead of a live model response. Prompt: "${promptPreview}"${imageContext}.`;
}

function buildCapacityFallback(parsed: z.infer<typeof llmPayloadSchema>) {
  const trimmedPrompt = parsed.userMessage.trim();
  const promptPreview = trimmedPrompt.length > 160 ? `${trimmedPrompt.slice(0, 157)}...` : trimmedPrompt;
  return `Gemini models are currently under high demand, so this run used a local fallback instead of a live model response. Prompt: "${promptPreview}".`;
}

const imageGenerationPayloadSchema = z.object({
  model: z.string(),
  systemPrompt: z.string().optional(),
  userMessage: z.string(),
  images: z.array(z.string()).default([]),
});

const fallbackImageModels = ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"];
const transloaditApiBase = "https://api2.transloadit.com";

function buildImageGenerationBody(parsed: z.infer<typeof imageGenerationPayloadSchema>) {
  const parts = [];

  if (parsed.systemPrompt?.trim()) {
    parts.push({ text: `Style guidance: ${parsed.systemPrompt.trim()}` });
  }

  parts.push({ text: parsed.userMessage });

  for (const image of parsed.images) {
    const dataUrlMatch = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (dataUrlMatch) {
      parts.push({
        inlineData: {
          mimeType: dataUrlMatch[1],
          data: dataUrlMatch[2],
        },
      });
    } else {
      parts.push({ text: `Reference image URL: ${image}` });
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

function extractGeneratedImage(response: unknown) {
  const candidates = Array.isArray((response as { candidates?: unknown[] })?.candidates)
    ? ((response as { candidates?: Array<{ content?: { parts?: unknown[] } }> }).candidates ?? [])
    : [];

  for (const candidate of candidates) {
    const parts = candidate.content?.parts ?? [];
    for (const part of parts) {
      if (typeof part === "object" && part && "inlineData" in part) {
        const inlineData = (part as { inlineData?: { mimeType?: string; data?: string } }).inlineData;
        if (inlineData?.mimeType?.startsWith("image/") && inlineData.data) {
          return `data:${inlineData.mimeType};base64,${inlineData.data}`;
        }
      }
    }
  }

  return undefined;
}

function extractGeneratedText(response: unknown) {
  const candidates = Array.isArray((response as { candidates?: unknown[] })?.candidates)
    ? ((response as { candidates?: Array<{ content?: { parts?: unknown[] } }> }).candidates ?? [])
    : [];

  const chunks: string[] = [];

  for (const candidate of candidates) {
    const parts = candidate.content?.parts ?? [];
    for (const part of parts) {
      if (typeof part === "object" && part && "text" in part) {
        const value = (part as { text?: unknown }).text;
        if (typeof value === "string" && value.trim()) {
          chunks.push(value.trim());
        }
      }
    }
  }

  return chunks.join("\n\n").trim() || undefined;
}

function isPublicHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createTransloaditToken() {
  const response = await fetch(`${transloaditApiBase}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.transloaditKey}:${env.transloaditSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "assemblies:read assemblies:write",
    }),
  });

  if (!response.ok) {
    throw new Error(`Transloadit token request failed: ${await response.text()}`);
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Transloadit token response did not include an access token.");
  }

  return json.access_token;
}

async function createTransloaditAssembly(steps: Record<string, unknown>, token: string) {
  const params = {
    auth: {
      key: env.transloaditKey,
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      nonce: crypto.randomUUID(),
    },
    steps,
  };

  const form = new FormData();
  form.set("params", JSON.stringify(params));

  const response = await fetch(`${transloaditApiBase}/assemblies`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Transloadit assembly creation failed: ${await response.text()}`);
  }

  return (await response.json()) as { assembly_ssl_url?: string; assembly_id?: string; error?: string; message?: string };
}

async function pollTransloaditAssembly(assemblyUrl: string, token: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await fetch(assemblyUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Transloadit assembly status fetch failed: ${await response.text()}`);
    }

    const json = (await response.json()) as {
      ok?: string;
      error?: string;
      message?: string;
      results?: Record<string, Array<{ ssl_url?: string; url?: string }>>;
    };

    if (json.error) {
      throw new Error(json.message || json.error);
    }

    if (json.ok === "ASSEMBLY_COMPLETED") {
      return json;
    }

    if (json.ok && json.ok !== "ASSEMBLY_EXECUTING" && json.ok !== "ASSEMBLY_UPLOADING") {
      throw new Error(json.message || `Unexpected Transloadit assembly state: ${json.ok}`);
    }

    await sleep(1500);
  }

  throw new Error("Transloadit assembly timed out.");
}

function getTransloaditResultUrl(
  assembly: { results?: Record<string, Array<{ ssl_url?: string; url?: string }>> },
  stepName: string,
) {
  const file = assembly.results?.[stepName]?.[0];
  return file?.ssl_url ?? file?.url ?? "";
}

async function requestGeneratedImage(model: string, parsed: z.infer<typeof imageGenerationPayloadSchema>) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.googleGenerativeAiApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildImageGenerationBody(parsed)),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    const isQuotaError = response.status === 429 || message.toLowerCase().includes("quota");

    if (isQuotaError) {
      return {
        ok: false as const,
        quota: true,
        message: "Gemini image quota exceeded. Try again later or switch models.",
      };
    }

    return {
      ok: false as const,
      quota: false,
      message: `Gemini image generation failed: ${message}`,
    };
  }

  const json = (await response.json()) as unknown;
  return {
    ok: true as const,
    image: extractGeneratedImage(json),
    text: extractGeneratedText(json),
  };
}

export const runLlmNodeTask = task({
  id: "run-llm-node",
  maxDuration: 300,
  run: async (payload: unknown) => {
    const parsed = llmPayloadSchema.parse(payload);
    if (!env.googleGenerativeAiApiKey) {
      return {
        output: "Gemini key missing. Configure GOOGLE_GENERATIVE_AI_API_KEY to enable real Trigger.dev execution.",
      };
    }

    const client = new GoogleGenerativeAI(env.googleGenerativeAiApiKey);
    const parts: Part[] = [{ text: parsed.userMessage }, ...parsed.images.map((image, index) => imageToPart(image, index))];
    const models = [parsed.model, ...fallbackLlmModels.filter((model) => model !== parsed.model)];
    let lastCapacityError = false;

    for (const modelName of models) {
      try {
        const model = client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          systemInstruction: parsed.systemPrompt || undefined,
          contents: [{ role: "user", parts }],
        });

        return {
          output: result.response.text(),
          model: modelName,
          note: modelName === parsed.model ? undefined : `LLM request completed with fallback model ${modelName}.`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const normalized = message.toLowerCase();
        const isQuotaError = message.includes("429") || normalized.includes("quota");
        const isCapacityError = message.includes("503") || normalized.includes("high demand") || normalized.includes("service unavailable");

        if (isQuotaError) {
          return {
            output: buildQuotaFallback(parsed),
            degraded: true,
            reason: "Gemini quota exceeded",
          };
        }

        if (isCapacityError) {
          lastCapacityError = true;
          continue;
        }

        throw error;
      }
    }

    if (lastCapacityError) {
      return {
        output: buildCapacityFallback(parsed),
        degraded: true,
        reason: "Gemini temporarily unavailable",
      };
    }

    return {
      output: buildCapacityFallback(parsed),
      degraded: true,
      reason: "Gemini temporarily unavailable",
    };
  },
});

export const cropImageNodeTask = task({
  id: "crop-image-node",
  maxDuration: 300,
  run: async (
    payload: unknown,
  ) => {
    const parsed = z
      .object({
        imageUrl: z.string().url(),
        xPercent: z.string(),
        yPercent: z.string(),
        widthPercent: z.string(),
        heightPercent: z.string(),
      })
      .parse(payload);

    if (!env.transloaditKey || !env.transloaditSecret) {
      return {
        output: parsed.imageUrl,
        note: "Transloadit credentials missing. Configure TRANSLOADIT_KEY and TRANSLOADIT_SECRET to enable backend crop processing.",
      };
    }

    if (!isPublicHttpUrl(parsed.imageUrl)) {
      return {
        output: parsed.imageUrl,
        note: "Crop processing currently requires a public http(s) image URL for backend Transloadit execution.",
      };
    }

    const x1 = `${parsed.xPercent}%`;
    const y1 = `${parsed.yPercent}%`;
    const x2 = `${Math.min(100, Math.max(0, Number.parseFloat(parsed.xPercent) + Number.parseFloat(parsed.widthPercent)))}%`;
    const y2 = `${Math.min(100, Math.max(0, Number.parseFloat(parsed.yPercent) + Number.parseFloat(parsed.heightPercent)))}%`;

    const token = await createTransloaditToken();
    const created = await createTransloaditAssembly(
      {
        imported: {
          robot: "/http/import",
          url: parsed.imageUrl,
        },
        cropped: {
          robot: "/image/resize",
          use: "imported",
          result: true,
          format: "png",
          crop: {
            x1,
            y1,
            x2,
            y2,
          },
        },
      },
      token,
    );

    if (!created.assembly_ssl_url) {
      throw new Error(created.message || "Transloadit did not return an assembly URL for crop processing.");
    }

    const completed = await pollTransloaditAssembly(created.assembly_ssl_url, token);
    const output = getTransloaditResultUrl(completed, "cropped");

    if (!output) {
      throw new Error("Transloadit crop processing completed without an output file.");
    }

    return {
      output,
    };
  },
});

export const generateImageNodeTask = task({
  id: "generate-image-node",
  maxDuration: 300,
  run: async (payload: unknown) => {
    const parsed = imageGenerationPayloadSchema.parse(payload);

    if (!env.googleGenerativeAiApiKey) {
      return {
        output: "",
        note: "Gemini key missing. Configure GOOGLE_GENERATIVE_AI_API_KEY to enable image generation.",
      };
    }

    const models = [parsed.model, ...fallbackImageModels.filter((model) => model !== parsed.model)];
    let lastMessage = "No image was generated.";

    for (const model of models) {
      const result = await requestGeneratedImage(model, parsed);

      if (!result.ok) {
        if (result.quota) {
          lastMessage = result.message;
          continue;
        }

        throw new Error(result.message);
      }

      if (result.image) {
        return {
          output: result.image,
          model,
          note: model === parsed.model ? undefined : `Generated with fallback model ${model}.`,
        };
      }

      lastMessage = result.text
        ? `Gemini returned text instead of an image: ${result.text}`
        : `Gemini returned no image output for ${model}.`;
    }

    return {
      output: "",
      note: lastMessage,
      degraded: true,
    };
  },
});

export const extractFrameNodeTask = task({
  id: "extract-frame-node",
  maxDuration: 300,
  run: async (payload: unknown) => {
    const parsed = z
      .object({
        videoUrl: z.string().url(),
        timestamp: z.string(),
      })
      .parse(payload);

    if (!env.transloaditKey || !env.transloaditSecret) {
      return {
        output: parsed.videoUrl,
        note: "Transloadit credentials missing. Configure TRANSLOADIT_KEY and TRANSLOADIT_SECRET to enable backend frame extraction.",
      };
    }

    if (!isPublicHttpUrl(parsed.videoUrl)) {
      return {
        output: parsed.videoUrl,
        note: "Frame extraction currently requires a public http(s) video URL for backend Transloadit execution.",
      };
    }

    const token = await createTransloaditToken();
    const created = await createTransloaditAssembly(
      {
        imported: {
          robot: "/http/import",
          url: parsed.videoUrl,
        },
        frame: {
          robot: "/video/thumbs",
          use: "imported",
          result: true,
          offsets: [parsed.timestamp],
          format: "png",
          ffmpeg_stack: "v7.0.0",
        },
      },
      token,
    );

    if (!created.assembly_ssl_url) {
      throw new Error(created.message || "Transloadit did not return an assembly URL for frame extraction.");
    }

    const completed = await pollTransloaditAssembly(created.assembly_ssl_url, token);
    const output = getTransloaditResultUrl(completed, "frame");

    if (!output) {
      throw new Error("Transloadit frame extraction completed without an output file.");
    }

    return {
      output,
    };
  },
});
