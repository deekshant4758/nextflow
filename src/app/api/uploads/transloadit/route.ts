import { NextResponse } from "next/server";
import { env } from "@/lib/env";

const transloaditApiBase = "https://api2.transloadit.com";

type AssemblyStatus = {
  ok?: string;
  error?: string;
  message?: string;
  assembly_ssl_url?: string;
  uploads?: Array<{ ssl_url?: string; url?: string; name?: string; mime?: string }>;
};
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function isAllowedMime(kind: "image" | "video", mime: string) {
  if (kind === "image") {
    return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime);
  }

  return ["video/mp4", "video/webm", "video/quicktime"].includes(mime);
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

async function createUploadAssembly(file: File, token: string) {
  const params = {
    auth: {
      key: env.transloaditKey,
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      nonce: crypto.randomUUID(),
    },
    steps: {
      ":original": {
        robot: "/upload/handle",
      },
    },
  };

  const form = new FormData();
  form.set("params", JSON.stringify(params));
  form.set("file", file, file.name);

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

  return (await response.json()) as AssemblyStatus;
}

async function pollAssembly(assemblyUrl: string, token: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await fetch(assemblyUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Transloadit assembly status fetch failed: ${await response.text()}`);
    }

    const json = (await response.json()) as AssemblyStatus;

    if (json.error) {
      throw new Error(json.message || json.error);
    }

    if (json.ok === "ASSEMBLY_COMPLETED") {
      return json;
    }

    if (json.ok && json.ok !== "ASSEMBLY_EXECUTING" && json.ok !== "ASSEMBLY_UPLOADING") {
      throw new Error(json.message || `Unexpected Transloadit assembly state: ${json.ok}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  throw new Error("Transloadit upload timed out.");
}

export async function POST(request: Request) {
  if (!env.transloaditKey || !env.transloaditSecret) {
    return NextResponse.json({ error: "Transloadit is not configured." }, { status: 500 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Upload could not be read. Files larger than 10 MB are not supported." },
      { status: 413 },
    );
  }

  const fileValue = formData.get("file");
  const kindValue = formData.get("kind");
  const kind = kindValue === "video" ? "video" : "image";

  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: "A file upload is required." }, { status: 400 });
  }

  if (!isAllowedMime(kind, fileValue.type)) {
    return NextResponse.json({ error: `Unsupported ${kind} format.` }, { status: 400 });
  }

  if (fileValue.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `${kind === "image" ? "Images" : "Videos"} larger than 10 MB are not supported.` },
      { status: 413 },
    );
  }

  const token = await createTransloaditToken();
  const created = await createUploadAssembly(fileValue, token);

  if (!created.assembly_ssl_url) {
    return NextResponse.json(
      { error: created.message || "Transloadit did not return an assembly URL." },
      { status: 500 },
    );
  }

  const completed = await pollAssembly(created.assembly_ssl_url, token);
  const uploaded = completed.uploads?.[0];
  const url = uploaded?.ssl_url ?? uploaded?.url ?? "";

  if (!url) {
    return NextResponse.json({ error: "Transloadit upload completed without a file URL." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    url,
    fileName: uploaded?.name ?? fileValue.name,
    mime: uploaded?.mime ?? fileValue.type,
  });
}
