"use client";

import { memo, useRef, useState, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  AlignLeft,
  ChevronDown,
  FileOutput,
  GripVertical,
  Hash,
  Image as ImageIcon,
  Info,
  Music,
  Pencil,
  Play,
  Plus,
  ToggleLeft,
  Trash2,
  Upload,
  Video,
  File,
  Radio,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isInputConnected } from "@/lib/workflow-utils";
import { useWorkflowStudioStore } from "@/components/workflow/workflow-store";
import type { CropImageNodeData, GeminiNodeData, RequestNodeData, ResponseNodeData } from "@/types/workflow";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

async function parseJsonSafely(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ─── Field type menu items ───────────────────────────────────────────────────
const FIELD_TYPE_OPTIONS = [
  { label: "Text", icon: AlignLeft, type: "text_field" as const },
  { label: "Image", icon: ImageIcon, type: "image_field" as const },
];

// ─── Add-field dropdown ──────────────────────────────────────────────────────
function AddFieldDropdown({ onAdd }: { onAdd: (type: "text_field" | "image_field") => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] bg-[#f5f5f5] text-[#6b7280] hover:bg-[#ebebeb] transition-colors"
        title="Add field"
      >
        <Plus className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
          {FIELD_TYPE_OPTIONS.map(({ label, icon: Icon, type }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                onAdd(type);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Icon className="h-4 w-4 text-gray-400" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── NodeShell ───────────────────────────────────────────────────────────────
function NodeShell({
  id,
  title,
  children,
  running,
  headerRight,
  icon,
  nodeType,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  running?: boolean;
  headerRight?: React.ReactNode;
  icon?: React.ReactNode;
  nodeType?: string;
}) {
  const runSingleNode = useWorkflowStudioStore((state) => state.runSingleNode);
  const removeNode = useWorkflowStudioStore((state) => state.removeNode);
  const nodes = useWorkflowStudioStore((state) => state.nodes);
  const node = nodes.find((item) => item.id === id);
  const locked = node?.data.nodeType === "request" || node?.data.nodeType === "response";

  const requestNodesCount = nodes.filter((n) => n.type === "request").length;
  const isDeletable = node?.type === "request" ? requestNodesCount > 1 : node?.deletable !== false;

  return (
    <div
      className={cn(
        "relative w-[380px] min-w-[380px] rounded-2xl border bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)]",
        nodeType === "request" ? "border-[rgba(245,158,11,0.3)]" : nodeType === "response" ? "border-[rgba(34,197,94,0.3)]" : "border-[#e8eaed]",
        running && "running-node",
      )}
      style={{ overflow: "visible" }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f1f3f5]">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0f1ff] text-[#6366f1]">
              {icon}
            </div>
          )}
          <span className="text-[13px] font-semibold text-[#111827]">{title}</span>
          <Info className="h-3.5 w-3.5 text-[#c4c9d4] cursor-pointer" />
        </div>
        <div className="flex items-center gap-1.5">
          {headerRight}
          {!locked && (
            <button
              type="button"
              className="cursor-pointer flex h-7 items-center gap-1 rounded-md border border-[#d1fae5] bg-[#f0fdf4] px-2 text-[11px] font-semibold text-[#16a34a] hover:bg-[#dcfce7] transition-colors"
              onClick={() => runSingleNode(id)}
            >
              <Play className="h-3 w-3 fill-current" />
              Run
            </button>
          )}
          {isDeletable && (
            <button
              type="button"
              className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-md bg-[#f5f5f5] text-[#9ca3af] hover:bg-[#efefef] hover:text-[#4b5563] transition-colors"
              onClick={() => removeNode(id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── InputLabel ──────────────────────────────────────────────────────────────
function InputLabel({
  label,
  accent,
}: {
  label: string;
  accent: "text" | "image" | "result" | "video" | "audio";
}) {
  const dotColor =
    accent === "image" ? "bg-[#4f7cff]" :
      accent === "result" ? "bg-[#22c55e]" :
        accent === "video" ? "bg-[#a855f7]" :
          accent === "audio" ? "bg-[#06b6d4]" :
            "bg-[#f59e0b]";

  return (
    <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide">
      <span className={cn("h-2 w-2 rounded-full flex-shrink-0", dotColor)} />
      <span>{label}</span>
    </div>
  );
}

// ─── CopyButton ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!text}
      className="cursor-pointer rounded p-1 hover:bg-[#e5e7eb] text-gray-400 hover:text-gray-600 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── UploadField ─────────────────────────────────────────────────────────────
function UploadField({
  value,
  onChange,
  label = "Upload Image",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
    const payload = (await parseJsonSafely(response)) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      throw new Error(payload.error || "Image upload failed.");
    }
    return payload.url;
  }

  const isUrl = value && (value.startsWith("http") || value.startsWith("data:"));
  const isUploaded = value && (value.startsWith("blob:") || value.includes(".r2.dev") || value.includes("/api/uploads"));

  return (
    <div className={cn("rounded-lg border border-[#e5e7eb] bg-[#fafafa] overflow-hidden", disabled && "opacity-75")}>
      {/* Preview if image is set */}
      {isUrl && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Uploaded"
            className="w-full max-h-40 object-cover border-b border-[#e5e7eb]"
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 border-b border-[#e5e7eb]">
              <div className="flex items-center gap-1.5">
                <svg className="animate-spin h-4 w-4 text-[#6366f1]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span className="text-[11px] font-medium text-[#6366f1]">Uploading…</span>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          disabled={disabled || uploading}
          className="cursor-pointer flex flex-1 h-8 items-center justify-center gap-1.5 rounded-md border border-dashed border-[#d1d5db] bg-white px-3 text-[11px] font-medium text-[#6b7280] hover:border-[#6366f1] hover:text-[#6366f1] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-[#6366f1]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Uploading…
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" />
              {label}
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          disabled={disabled || uploading}
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            // Show local preview immediately
            const localUrl = URL.createObjectURL(file);
            onChange(localUrl);
            setUploading(true);
            try {
              const url = await uploadFile(file);
              onChange(url);
            } finally {
              setUploading(false);
              event.target.value = "";
            }
          }}
        />
      </div>
      <input
        value={isUploaded ? "" : value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={disabled ? "Image is provided by incoming connection" : "Image URL..."}
        className="w-full border-t border-[#e5e7eb] bg-white px-3 py-2 text-[11px] text-[#111827] outline-none placeholder:text-[#c0c4cc] focus:border-t-[#c7d2fe] disabled:opacity-50"
      />
    </div>
  );
}

// ─── Slider input row ─────────────────────────────────────────────────────────
function SliderRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const num = parseFloat(value) || 0;

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={num}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="nodrag flex-1 h-1.5 accent-[#6366f1] cursor-pointer disabled:opacity-40"
      />
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="nodrag w-14 rounded-lg border border-[#e5e7eb] bg-white px-2 py-1 text-center text-[12px] font-medium text-[#111827] outline-none disabled:opacity-40"
      />
    </div>
  );
}

// ─── RequestNode ─────────────────────────────────────────────────────────────
function RequestNode({ id, data }: NodeProps) {
  const typedData = data as RequestNodeData;
  const addRequestField = useWorkflowStudioStore((state) => state.addRequestField);
  const updateRequestField = useWorkflowStudioStore((state) => state.updateRequestField);
  const removeRequestField = useWorkflowStudioStore((state) => state.removeRequestField);

  return (
    <NodeShell
      id={id}
      title="Request-Inputs"
      running={typedData.running}
      nodeType="request"
      headerRight={
        <AddFieldDropdown onAdd={(type) => addRequestField(id, type)} />
      }
    >
      <div className="space-y-3 px-4 py-3">
        {typedData.fields.map((field) => {
          const isImage = field.type === "image_field";
          return (
            <div key={field.id} className="relative">
              {/* Field header row */}
              <div className="mb-1.5 flex items-center gap-2">
                <GripVertical className="h-3.5 w-3.5 text-[#d1d5db] cursor-grab" />
                <input
                  value={field.label}
                  onChange={(event) => updateRequestField(id, field.id, { label: event.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-[#374151] outline-none"
                />
                <Info className="h-3 w-3 text-[#d1d5db]" />
                <Pencil className="h-3 w-3 text-[#d1d5db] cursor-pointer hover:text-[#6b7280]" />
                <button
                  type="button"
                  className="cursor-pointer rounded p-0.5 text-[#d1d5db] hover:text-[#ef4444] transition-colors"
                  onClick={() => removeRequestField(id, field.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {isImage ? (
                <UploadField
                  value={field.value}
                  onChange={(value) => updateRequestField(id, field.id, { value })}
                />
              ) : (
                <textarea
                  rows={2}
                  value={field.value}
                  onChange={(event) => updateRequestField(id, field.id, { value: event.target.value })}
                  placeholder="Enter text..."
                  className="w-full resize-none rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-[12px] text-[#111827] outline-none placeholder:text-[#c0c4cc] focus:border-[#c7d2fe] focus:bg-white transition-colors nowheel nodrag custom-scrollbar"
                />
              )}

              {/* Source handle — centered in this field's div */}
              <Handle
                type="source"
                position={Position.Right}
                id={field.id}
                className="!absolute !h-[14px] !w-[14px] !rounded-full !border-2"
                style={{
                  right: -23,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: isImage ? "#4f7cff" : "#f59e0b",
                  borderColor: isImage ? "rgba(79,124,255,0.4)" : "rgba(245,158,11,0.4)",
                  boxShadow: isImage
                    ? "0 0 8px rgba(79,124,255,0.3)"
                    : "0 0 8px rgba(245,158,11,0.3)",
                }}
              />
            </div>
          );
        })}
      </div>
    </NodeShell>
  );
}

// ─── GeminiNode ──────────────────────────────────────────────────────────────
function GeminiNode({ id, data }: NodeProps) {
  const typedData = data as GeminiNodeData;
  const edges = useWorkflowStudioStore((state) => state.edges);
  const updateNodeData = useWorkflowStudioStore((state) => state.updateNodeData);

  return (
    <>
      <NodeShell id={id} title="Gemini 2.5 Flash" running={typedData.running}>
        <div className="space-y-3 px-4 py-3">
          {/* Prompt */}
          <div className="relative overflow-visible">
            <Handle
              type="target"
              position={Position.Left}
              id="prompt"
              className="!absolute !h-[14px] !w-[14px] !rounded-full !border-2"
              style={{
                left: -23,
                top: 8,
                transform: "translateY(-50%)",
                background: "#f59e0b",
                borderColor: "rgba(245,158,11,0.4)",
                boxShadow: "0 0 8px rgba(245,158,11,0.3)",
              }}
            />
            <InputLabel label="Prompt*" accent="text" />
            <div className="relative">
              <textarea
                rows={3}
                value={typedData.prompt}
                disabled={isInputConnected(edges, id, "prompt")}
                onChange={(event) => updateNodeData(id, { prompt: event.target.value })}
                placeholder="Enter your prompt..."
                className="w-full resize-none rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-[12px] text-[#111827] outline-none placeholder:text-[#c0c4cc] disabled:opacity-50 focus:border-[#c7d2fe] focus:bg-white transition-colors nowheel nodrag custom-scrollbar max-h-24 overflow-y-auto"
              />
              <button type="button" className="absolute bottom-2 right-2 text-[#d1d5db] hover:text-[#6b7280]">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* System Prompt */}
          <div className="relative overflow-visible">
            <Handle
              type="target"
              position={Position.Left}
              id="system_prompt"
              className="!absolute !h-[14px] !w-[14px] !rounded-full !border-2"
              style={{
                left: -23,
                top: 8,
                transform: "translateY(-50%)",
                background: "#f59e0b",
                borderColor: "rgba(245,158,11,0.4)",
                boxShadow: "0 0 8px rgba(245,158,11,0.3)",
              }}
            />
            <InputLabel label="System Prompt" accent="text" />
            <div className="relative">
              <textarea
                rows={3}
                value={typedData.systemPrompt}
                disabled={isInputConnected(edges, id, "system_prompt")}
                onChange={(event) => updateNodeData(id, { systemPrompt: event.target.value })}
                placeholder="You are a helpful assistant..."
                className="w-full resize-none rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-[12px] text-[#111827] outline-none placeholder:text-[#c0c4cc] disabled:opacity-50 focus:border-[#c7d2fe] focus:bg-white transition-colors nowheel nodrag custom-scrollbar max-h-24 overflow-y-auto"
              />
              <button type="button" className="absolute bottom-2 right-2 text-[#d1d5db] hover:text-[#6b7280]">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Image Vision */}
          <div className="relative overflow-visible">
            <Handle
              type="target"
              position={Position.Left}
              id="image_vision"
              className="!absolute !h-[14px] !w-[14px] !rounded-full !border-2"
              style={{
                left: -23,
                top: 8,
                transform: "translateY(-50%)",
                background: "#4f7cff",
                borderColor: "rgba(79,124,255,0.4)",
                boxShadow: "0 0 8px rgba(79,124,255,0.3)",
              }}
            />
            <InputLabel label="Image (Vision)" accent="image" />
            <UploadField
              value={typedData.imageInput || ""}
              disabled={isInputConnected(edges, id, "image_vision")}
              onChange={(value) => updateNodeData(id, { imageInput: value })}
            />
          </div>

          {/* Response output */}
          <div className="relative overflow-visible border-t border-[#f1f3f5] pt-3">
            <Handle
              type="source"
              position={Position.Right}
              id="output"
              className="!absolute !h-[14px] !w-[14px] !rounded-full !border-2"
              style={{
                right: -23,
                top: 20,
                transform: "translateY(-50%)",
                background: "#22c55e",
                borderColor: "rgba(34,197,94,0.4)",
                boxShadow: "0 0 8px rgba(34,197,94,0.3)",
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide">Response</span>
              {typedData.response && <CopyButton text={typedData.response} />}
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-3 text-[11px] text-[#4b5563] break-words whitespace-pre-wrap nowheel nodrag custom-scrollbar">
              {typedData.response || "No output yet"}
            </div>
          </div>
        </div>
      </NodeShell>
    </>
  );
}

// ─── CropImageNode ────────────────────────────────────────────────────────────
function CropImageNode({ id, data }: NodeProps) {
  const typedData = data as CropImageNodeData;
  const edges = useWorkflowStudioStore((state) => state.edges);
  const updateNodeData = useWorkflowStudioStore((state) => state.updateNodeData);

  const cropParams: Array<[string, keyof CropImageNodeData, string]> = [
    ["X Position (%)", "xPercent", "x_percent"],
    ["Y Position (%)", "yPercent", "y_percent"],
    ["Width (%)", "widthPercent", "width_percent"],
    ["Height (%)", "heightPercent", "height_percent"],
  ];

  return (
    <>
      <NodeShell id={id} title="Crop Image" running={typedData.running}>
        <div className="space-y-3 px-4 py-3">
          {/* Input image */}
          <div className="relative overflow-visible">
            <Handle
              type="target"
              position={Position.Left}
              id="input_image"
              className="!absolute !h-[14px] !w-[14px] !rounded-full !border-2"
              style={{
                left: -23,
                top: 8,
                transform: "translateY(-50%)",
                background: "#4f7cff",
                borderColor: "rgba(79,124,255,0.4)",
                boxShadow: "0 0 8px rgba(79,124,255,0.3)",
              }}
            />
            <InputLabel label="Input Image*" accent="image" />
            <UploadField
              value={typedData.imageUrl}
              onChange={(value) => updateNodeData(id, { imageUrl: value })}
            />
          </div>

          {/* Slider rows for each crop param */}
          {cropParams.map(([label, key, handle]) => (
            <div key={key} className="relative overflow-visible">
              <Handle
                type="target"
                position={Position.Left}
                id={handle}
                className="!absolute !h-[14px] !w-[14px] !rounded-full !border-2"
                style={{
                  left: -23,
                  top: 8,
                  transform: "translateY(-50%)",
                  background: "#ec4899",
                  borderColor: "rgba(236,72,153,0.4)",
                  boxShadow: "0 0 8px rgba(236,72,153,0.3)",
                }}
              />
              <InputLabel label={label} accent="text" />
              <SliderRow
                label={label}
                value={typedData[key] as string}
                disabled={isInputConnected(edges, id, handle)}
                onChange={(v) => updateNodeData(id, { [key]: v } as Partial<CropImageNodeData>)}
              />
            </div>
          ))}

          {/* Output image */}
          <div className="relative overflow-visible border-t border-[#f1f3f5] pt-3">
            <Handle
              type="source"
              position={Position.Right}
              id="output_image"
              className="!absolute !h-[14px] !w-[14px] !rounded-full !border-2"
              style={{
                right: -23,
                top: 20,
                transform: "translateY(-50%)",
                background: "#4f7cff",
                borderColor: "rgba(79,124,255,0.4)",
                boxShadow: "0 0 8px rgba(79,124,255,0.3)",
              }}
            />
            <span className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide">Output Image</span>
            <div className="relative mt-2 min-h-20 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] overflow-hidden">
              {typedData.outputImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={typedData.outputImage} alt="Crop output" className="w-full object-cover" />
              ) : (
                <div className="flex h-20 items-center justify-center text-[11px] text-[#c0c4cc]">
                  No output yet
                </div>
              )}
            </div>
          </div>
        </div>
      </NodeShell>
    </>
  );
}

// ─── ResponseNode ─────────────────────────────────────────────────────────────
function ResponseNode({ id, data }: NodeProps) {
  const typedData = data as ResponseNodeData;

  return (
    <>
      <NodeShell
        id={id}
        title="Response"
        running={typedData.running}
        nodeType="response"
        icon={<FileOutput className="h-4 w-4" />}
      >
        {/* Handle flush with node border */}
        <Handle
          type="target"
          position={Position.Left}
          id="result"
          className="!absolute !h-[14px] !w-[14px] !rounded-full !border-2"
          style={{
            left: -7,
            top: "50%",
            transform: "translateY(-50%)",
            background: "#6366f1",
            borderColor: "rgba(99,102,241,0.4)",
            boxShadow: "0 0 8px rgba(99,102,241,0.3)",
          }}
        />

        <div className="space-y-3 p-4">
          <div className="space-y-2">
            {typedData.items.length === 0 ? (
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3 text-center text-[11px] text-[#c0c4cc]">
                Connect node outputs here to define what your workflow returns.
              </div>
            ) : (
              typedData.items.map((item) => {
                const isImageUrl =
                  typeof item.value === "string" &&
                  (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(item.value) ||
                    (item.value.startsWith("http") && item.value.includes("unsplash")));
                return (
                  <div key={item.id} className="rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="min-w-0 flex-1 text-[13px] font-medium text-[#111827]">
                        {item.sourceNodeLabel}
                      </span>
                      <Pencil className="h-3.5 w-3.5 text-[#c4c9d4] cursor-pointer hover:text-[#6b7280]" />
                      <Trash2 className="h-3.5 w-3.5 text-[#c4c9d4] cursor-pointer hover:text-[#ef4444]" />
                    </div>
                    {item.value && isImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.value}
                        alt={item.sourceNodeLabel}
                        className="w-full rounded-lg object-cover max-h-48 border border-[#e5e7eb]"
                      />
                    ) : (
                      <div className="relative">
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-[11px] text-[#4b5563] break-words whitespace-pre-wrap pr-10 min-h-10 flex items-start nowheel nodrag custom-scrollbar">
                          <span className={cn(!item.value && "text-[#c0c4cc] flex-1 text-center self-center")}>
                            {item.value || "No output yet"}
                          </span>
                        </div>
                        {item.value && (
                          <div className="absolute right-2 top-2">
                            <CopyButton text={item.value} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </NodeShell>
    </>
  );
}

export const nodeTypes = {
  request: memo(RequestNode),
  gemini: memo(GeminiNode),
  cropImage: memo(CropImageNode),
  response: memo(ResponseNode),
};
