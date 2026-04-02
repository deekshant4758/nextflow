"use client";

import { memo, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bot, Crop, FileText, Film, Image as ImageIcon, Play, Trash2, Upload, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { isInputConnected } from "@/lib/workflow-utils";
import { useWorkflowStudioStore } from "@/components/workflow/workflow-store";
import type {
  CropImageNodeData,
  ExtractFrameNodeData,
  GenerateImageNodeData,
  RunLlmNodeData,
  TextNodeData,
  UploadImageNodeData,
  UploadVideoNodeData,
} from "@/types/workflow";

const llmModels = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3-flash", "gemma-3-27b-it"];
const imageModels = ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

async function parseJsonSafely(response: Response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function Field({
  label,
  value,
  placeholder,
  disabled,
  multiline,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  const className =
    "mt-2 w-full rounded-2xl border border-white/8 bg-black/25 px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/35 focus:border-white/20 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/35";

  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">{label}</span>
      {multiline ? (
        <textarea
          className={cn(className, "min-h-24 resize-none")}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={className}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">{label}</span>
      <select
        className="mt-2 w-full rounded-2xl border border-white/8 bg-black/25 px-3 py-2.5 text-xs text-white outline-none focus:border-white/20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NodeFrame({
  id,
  icon,
  title,
  description,
  running,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  running?: boolean;
  children: React.ReactNode;
}) {
  const removeNode = useWorkflowStudioStore((state) => state.removeNode);
  const runSingleNode = useWorkflowStudioStore((state) => state.runSingleNode);

  return (
    <div
      className={cn(
        "min-w-[280px] max-w-[320px] rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl",
        running && "running-node",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/7 text-white">
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-xs leading-5 text-secondary">{description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={`Run ${title}`}
            title="Run node"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white transition-colors hover:bg-white/14"
            onClick={() => runSingleNode(id)}
          >
            <Play className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${title}`}
            title="Delete node"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-secondary transition-colors hover:bg-red-500/18 hover:text-red-100"
            onClick={() => removeNode(id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function TextNode({ id, data }: NodeProps) {
  const typedData = data as TextNodeData;
  const updateNodeData = useWorkflowStudioStore((state) => state.updateNodeData);
  return (
    <>
      <Handle type="source" position={Position.Right} id="output" className="!h-3 !w-3 !border-0 !bg-white" />
      <NodeFrame id={id} icon={<FileText className="h-5 w-5" />} title={typedData.label} description={typedData.description} running={typedData.running}>
        <Field
          label={typedData.role === "system" ? "System Prompt" : "Text Value"}
          value={typedData.text}
          multiline
          onChange={(value) => updateNodeData(id, { text: value })}
        />
      </NodeFrame>
    </>
  );
}

function UploadImageNode({ id, data }: NodeProps) {
  const typedData = data as UploadImageNodeData;
  const updateNodeData = useWorkflowStudioStore((state) => state.updateNodeData);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error("Images larger than 10 MB are not supported.");
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("kind", "image");

    const response = await fetch("/api/uploads/transloadit", {
      method: "POST",
      body: formData,
    });

    const payload = (await parseJsonSafely(response)) as { ok?: boolean; url?: string; fileName?: string; error?: string };

    if (!response.ok || !payload.url) {
      throw new Error(payload.error || "Image upload failed.");
    }

    return payload;
  }

  return (
    <>
      <Handle type="source" position={Position.Right} id="output" className="!h-3 !w-3 !border-0 !bg-white" />
      <NodeFrame id={id} icon={<ImageIcon className="h-5 w-5" />} title={typedData.label} description={typedData.description} running={typedData.running}>
        {typedData.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={typedData.imageUrl} alt={typedData.fileName ?? "Uploaded preview"} className="mb-3 h-36 w-full rounded-[22px] object-cover" />
        ) : (
          <div className="mb-3 flex h-36 items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-black/20 text-xs text-secondary">
            Upload an image or paste a URL
          </div>
        )}
        <button
          type="button"
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/12"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Upload Image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }

            try {
              updateNodeData(id, { result: "Uploading image..." });
              const uploaded = await uploadFile(file);
              updateNodeData(id, {
                fileName: uploaded.fileName ?? file.name,
                imageUrl: uploaded.url,
                result: "Image uploaded successfully.",
              });
            } catch (error) {
              updateNodeData(id, {
                result: error instanceof Error ? error.message : "Image upload failed.",
              });
            } finally {
              event.target.value = "";
            }
          }}
        />
        {typedData.result ? <p className="mb-3 text-xs leading-6 text-secondary">{typedData.result}</p> : null}
        <Field label="Image URL" value={typedData.imageUrl ?? ""} onChange={(value) => updateNodeData(id, { imageUrl: value })} />
      </NodeFrame>
    </>
  );
}

function UploadVideoNode({ id, data }: NodeProps) {
  const typedData = data as UploadVideoNodeData;
  const updateNodeData = useWorkflowStudioStore((state) => state.updateNodeData);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error("Videos larger than 10 MB are not supported.");
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("kind", "video");

    const response = await fetch("/api/uploads/transloadit", {
      method: "POST",
      body: formData,
    });

    const payload = (await parseJsonSafely(response)) as { ok?: boolean; url?: string; fileName?: string; error?: string };

    if (!response.ok || !payload.url) {
      throw new Error(payload.error || "Video upload failed.");
    }

    return payload;
  }

  return (
    <>
      <Handle type="source" position={Position.Right} id="output" className="!h-3 !w-3 !border-0 !bg-white" />
      <NodeFrame id={id} icon={<Video className="h-5 w-5" />} title={typedData.label} description={typedData.description} running={typedData.running}>
        {typedData.videoUrl ? <video className="mb-3 h-36 w-full rounded-[22px] object-cover" src={typedData.videoUrl} controls muted /> : null}
        <button
          type="button"
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/12"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Upload Video
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }

            try {
              updateNodeData(id, { result: "Uploading video..." });
              const uploaded = await uploadFile(file);
              updateNodeData(id, {
                fileName: uploaded.fileName ?? file.name,
                videoUrl: uploaded.url,
                result: "Video uploaded successfully.",
              });
            } catch (error) {
              updateNodeData(id, {
                result: error instanceof Error ? error.message : "Video upload failed.",
              });
            } finally {
              event.target.value = "";
            }
          }}
        />
        {typedData.result ? <p className="mb-3 text-xs leading-6 text-secondary">{typedData.result}</p> : null}
        <Field label="Video URL" value={typedData.videoUrl ?? ""} onChange={(value) => updateNodeData(id, { videoUrl: value })} />
      </NodeFrame>
    </>
  );
}

function RunLlmNode({ id, data }: NodeProps) {
  const typedData = data as RunLlmNodeData;
  const edges = useWorkflowStudioStore((state) => state.edges);
  const updateNodeData = useWorkflowStudioStore((state) => state.updateNodeData);
  const connectedImages = typedData.connectedImages ?? [];
  const userMessageConnected = isInputConnected(edges, id, "user_message");
  const systemPromptConnected = isInputConnected(edges, id, "system_prompt");
  const hasImageInputs = connectedImages.length > 0;

  return (
    <>
      <Handle type="target" position={Position.Left} id="system_prompt" style={{ top: 76 }} className="!h-3 !w-3 !border-0 !bg-white" />
      <Handle type="target" position={Position.Left} id="user_message" style={{ top: 140 }} className="!h-3 !w-3 !border-0 !bg-white" />
      <Handle type="target" position={Position.Left} id="images" style={{ top: 204 }} className="!h-3 !w-3 !border-0 !bg-white" />
      <Handle type="source" position={Position.Right} id="output" className="!h-3 !w-3 !border-0 !bg-white" />
      <NodeFrame id={id} icon={<Bot className="h-5 w-5" />} title={typedData.label} description={typedData.description} running={typedData.running}>
        <SelectField label="Model" value={typedData.model} options={llmModels} onChange={(value) => updateNodeData(id, { model: value })} />
        <Field
          label="System Prompt"
          value={typedData.systemPrompt}
          placeholder="Connected text node or inline system prompt"
          disabled={systemPromptConnected}
          multiline
          onChange={(value) => updateNodeData(id, { systemPrompt: value })}
        />
        <Field
          label="User Message"
          value={typedData.userMessage}
          placeholder="Connected text node or inline message"
          disabled={userMessageConnected}
          multiline
          onChange={(value) => updateNodeData(id, { userMessage: value })}
        />
        <div className="mt-4 rounded-[22px] border border-white/8 bg-black/25 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">Image Inputs</p>
            <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
              {connectedImages.length}
            </span>
          </div>
          <p className="mt-2 text-xs leading-6 text-secondary">
            {hasImageInputs ? "Connected images will be passed to the LLM during execution." : "Connect one or more image nodes here if the prompt needs visual context."}
          </p>
          {hasImageInputs ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {connectedImages.slice(0, 6).map((imageUrl, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${imageUrl}-${index}`} src={imageUrl} alt={`Connected input ${index + 1}`} className="h-16 w-full rounded-2xl object-cover" />
              ))}
            </div>
          ) : null}
        </div>
        {!typedData.userMessage.trim() ? (
          <div className="mt-4 rounded-[22px] border border-amber-400/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-100">
            {userMessageConnected
              ? "A text node must be connected to the user message input before this node can run."
              : "User message is required. Add it inline or connect a text node to the user message input."}
          </div>
        ) : null}
        <div className="mt-4 rounded-[22px] border border-white/8 bg-black/25 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">Inline Result</p>
          <p className="mt-2 line-clamp-5 overflow-hidden text-xs leading-6 text-white/90">
            {typedData.result ?? "Run this node to render the LLM response inline."}
          </p>
        </div>
      </NodeFrame>
    </>
  );
}

function GenerateImageNode({ id, data }: NodeProps) {
  const typedData = data as GenerateImageNodeData;
  const edges = useWorkflowStudioStore((state) => state.edges);
  const updateNodeData = useWorkflowStudioStore((state) => state.updateNodeData);
  const connectedImages = typedData.connectedImages ?? [];
  const userMessageConnected = isInputConnected(edges, id, "user_message");
  const systemPromptConnected = isInputConnected(edges, id, "system_prompt");

  return (
    <>
      <Handle type="target" position={Position.Left} id="system_prompt" style={{ top: 76 }} className="!h-3 !w-3 !border-0 !bg-white" />
      <Handle type="target" position={Position.Left} id="user_message" style={{ top: 140 }} className="!h-3 !w-3 !border-0 !bg-white" />
      <Handle type="target" position={Position.Left} id="images" style={{ top: 204 }} className="!h-3 !w-3 !border-0 !bg-white" />
      <Handle type="source" position={Position.Right} id="output" className="!h-3 !w-3 !border-0 !bg-white" />
      <NodeFrame id={id} icon={<ImageIcon className="h-5 w-5" />} title={typedData.label} description={typedData.description} running={typedData.running}>
        <SelectField label="Model" value={typedData.model} options={imageModels} onChange={(value) => updateNodeData(id, { model: value })} />
        <Field
          label="Style / System Prompt"
          value={typedData.systemPrompt}
          placeholder="Optional connected text node or inline style guidance"
          disabled={systemPromptConnected}
          multiline
          onChange={(value) => updateNodeData(id, { systemPrompt: value })}
        />
        <Field
          label="Prompt"
          value={typedData.userMessage}
          placeholder="Describe the image you want to generate"
          disabled={userMessageConnected}
          multiline
          onChange={(value) => updateNodeData(id, { userMessage: value })}
        />
        <div className="mt-4 rounded-[22px] border border-white/8 bg-black/25 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">Reference Images</p>
            <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
              {connectedImages.length}
            </span>
          </div>
          <p className="mt-2 text-xs leading-6 text-secondary">
            {connectedImages.length
              ? "Connected images will be used as references for the generated result."
              : "Connect one or more images here for restyling or reference-guided generation."}
          </p>
          {connectedImages.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {connectedImages.slice(0, 6).map((imageUrl, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${imageUrl}-${index}`} src={imageUrl} alt={`Reference ${index + 1}`} className="h-16 w-full rounded-2xl object-cover" />
              ))}
            </div>
          ) : null}
        </div>
        {!typedData.userMessage.trim() ? (
          <div className="mt-4 rounded-[22px] border border-amber-400/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-100">
            {userMessageConnected ? "A text node must be connected to the prompt input before this node can run." : "Prompt is required."}
          </div>
        ) : null}
        <div className="mt-4 rounded-[22px] border border-white/8 bg-black/25 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">Generated Image</p>
          {typedData.result ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={typedData.result} alt="Generated output" className="mt-3 h-40 w-full rounded-[20px] object-cover" />
          ) : (
            <p className="mt-2 text-xs leading-6 text-white/90">Run this node to generate an image inline.</p>
          )}
        </div>
      </NodeFrame>
    </>
  );
}

function CropImageNode({ id, data }: NodeProps) {
  const typedData = data as CropImageNodeData;
  const edges = useWorkflowStudioStore((state) => state.edges);
  const updateNodeData = useWorkflowStudioStore((state) => state.updateNodeData);
  return (
    <>
      <Handle type="target" position={Position.Left} id="image_url" style={{ top: 92 }} className="!h-3 !w-3 !border-0 !bg-white" />
      <Handle type="target" position={Position.Left} id="x_percent" style={{ top: 162 }} className="!h-3 !w-3 !border-0 !bg-white" />
      <Handle type="target" position={Position.Left} id="y_percent" style={{ top: 224 }} className="!h-3 !w-3 !border-0 !bg-white" />
      <Handle type="target" position={Position.Left} id="width_percent" style={{ top: 286 }} className="!h-3 !w-3 !border-0 !bg-white" />
      <Handle type="target" position={Position.Left} id="height_percent" style={{ top: 348 }} className="!h-3 !w-3 !border-0 !bg-white" />
      <Handle type="source" position={Position.Right} id="output" className="!h-3 !w-3 !border-0 !bg-white" />
      <NodeFrame id={id} icon={<Crop className="h-5 w-5" />} title={typedData.label} description={typedData.description} running={typedData.running}>
        <Field label="Image URL" value={typedData.imageUrl} disabled={isInputConnected(edges, id, "image_url")} onChange={(value) => updateNodeData(id, { imageUrl: value })} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="X %" value={typedData.xPercent} disabled={isInputConnected(edges, id, "x_percent")} onChange={(value) => updateNodeData(id, { xPercent: value })} />
          <Field label="Y %" value={typedData.yPercent} disabled={isInputConnected(edges, id, "y_percent")} onChange={(value) => updateNodeData(id, { yPercent: value })} />
          <Field label="Width %" value={typedData.widthPercent} disabled={isInputConnected(edges, id, "width_percent")} onChange={(value) => updateNodeData(id, { widthPercent: value })} />
          <Field label="Height %" value={typedData.heightPercent} disabled={isInputConnected(edges, id, "height_percent")} onChange={(value) => updateNodeData(id, { heightPercent: value })} />
        </div>
      </NodeFrame>
    </>
  );
}

function ExtractFrameNode({ id, data }: NodeProps) {
  const typedData = data as ExtractFrameNodeData;
  const edges = useWorkflowStudioStore((state) => state.edges);
  const updateNodeData = useWorkflowStudioStore((state) => state.updateNodeData);
  return (
    <>
      <Handle type="target" position={Position.Left} id="video_url" style={{ top: 98 }} className="!h-3 !w-3 !border-0 !bg-white" />
      <Handle type="target" position={Position.Left} id="timestamp" style={{ top: 162 }} className="!h-3 !w-3 !border-0 !bg-white" />
      <Handle type="source" position={Position.Right} id="output" className="!h-3 !w-3 !border-0 !bg-white" />
      <NodeFrame id={id} icon={<Film className="h-5 w-5" />} title={typedData.label} description={typedData.description} running={typedData.running}>
        <Field label="Video URL" value={typedData.videoUrl} disabled={isInputConnected(edges, id, "video_url")} onChange={(value) => updateNodeData(id, { videoUrl: value })} />
        <Field label="Timestamp" value={typedData.timestamp} disabled={isInputConnected(edges, id, "timestamp")} onChange={(value) => updateNodeData(id, { timestamp: value })} />
        <div className="mt-4 rounded-[22px] border border-white/8 bg-black/25 p-3 text-xs leading-6 text-secondary">
          Use seconds like <span className="text-white">3.5</span> or percentages like <span className="text-white">50%</span>.
        </div>
      </NodeFrame>
    </>
  );
}

export const nodeTypes = {
  text: memo(TextNode),
  uploadImage: memo(UploadImageNode),
  uploadVideo: memo(UploadVideoNode),
  runLLM: memo(RunLlmNode),
  generateImage: memo(GenerateImageNode),
  cropImage: memo(CropImageNode),
  extractFrame: memo(ExtractFrameNode),
};
