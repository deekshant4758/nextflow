"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Bot,
  Check,
  Copy,
  FileImage,
  ImageDown,
  LayoutGrid,
  Pencil,
  Play,
  Plus,
  Redo2,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Video,
  X,
} from "lucide-react";
import { downloadAsset, downloadJson, formatDuration, formatTimestamp } from "@/lib/utils";
import { workflowTemplates } from "@/lib/workflow-sample";
import { scopeToLabel, statusToTone } from "@/lib/workflow-utils";
import { nodeTypes } from "@/components/workflow/nodes";
import { useWorkflowStudioStore } from "@/components/workflow/workflow-store";
import type { WorkflowNodeType, WorkflowRun } from "@/types/workflow";

const quickAccess: { type: WorkflowNodeType; label: string; icon: React.ReactNode }[] = [
  { type: "text", label: "Text", icon: <LayoutGrid className="h-4 w-4" /> },
  { type: "uploadImage", label: "Upload Image", icon: <FileImage className="h-4 w-4" /> },
  { type: "uploadVideo", label: "Upload Video", icon: <Video className="h-4 w-4" /> },
  { type: "runLLM", label: "Run Any LLM", icon: <Bot className="h-4 w-4" /> },
  { type: "generateImage", label: "Generate Image", icon: <Sparkles className="h-4 w-4" /> },
  { type: "cropImage", label: "Crop Image", icon: <Sparkles className="h-4 w-4" /> },
  { type: "extractFrame", label: "Extract Frame", icon: <Video className="h-4 w-4" /> },
];

function isImageOutput(output?: string) {
  return Boolean(output && (output.startsWith("data:image/") || /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(output)));
}

function isVideoOutput(output?: string) {
  return Boolean(output && (output.startsWith("data:video/") || /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(output)));
}

function VideoFramePreview({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [frameUrl, setFrameUrl] = useState<string>();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const capture = () => {
      if (!video.videoWidth || !video.videoHeight) {
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setFrameUrl(canvas.toDataURL("image/png"));
    };

    const handleLoadedData = () => {
      try {
        video.currentTime = Math.min(0.1, video.duration || 0);
      } catch {
        capture();
      }
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("seeked", capture);

    return () => {
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("seeked", capture);
    };
  }, [src]);

  return (
    <div>
      <video ref={videoRef} src={src} className="hidden" crossOrigin="anonymous" muted playsInline />
      {frameUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={frameUrl} alt="Extracted frame preview" className="mt-3 max-h-72 w-full rounded-[18px] object-cover" />
      ) : (
        <video src={src} className="mt-3 max-h-72 w-full rounded-[18px] object-cover" controls muted />
      )}
    </div>
  );
}

function OutputPreview({ output, nodeType }: { output?: string; nodeType: WorkflowNodeType }) {
  if (!output) {
    return null;
  }

  const filename =
    nodeType === "generateImage" || nodeType === "cropImage" || nodeType === "extractFrame"
      ? `${nodeType}-output.png`
      : "workflow-output";

  return (
    <div className="rounded-[24px] border border-white/8 bg-black/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">Output Preview</p>
        {(isImageOutput(output) || nodeType === "generateImage" || nodeType === "cropImage") && (
          <button
            type="button"
            onClick={() => downloadAsset(filename, output)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-white/12"
          >
            <ImageDown className="h-3.5 w-3.5" />
            Download
          </button>
        )}
      </div>

      {(nodeType === "uploadImage" || nodeType === "cropImage" || nodeType === "generateImage" || isImageOutput(output)) && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={output} alt="Node output preview" className="mt-3 max-h-72 w-full rounded-[18px] object-cover" />
        </>
      )}

      {nodeType === "extractFrame" && !isImageOutput(output) && <VideoFramePreview src={output} />}

      {(nodeType === "uploadVideo" || (isVideoOutput(output) && nodeType !== "extractFrame")) && (
        <video src={output} className="mt-3 max-h-72 w-full rounded-[18px] object-cover" controls muted />
      )}

      {!isImageOutput(output) && nodeType !== "extractFrame" && !(nodeType === "uploadVideo" || isVideoOutput(output)) && (
        <p className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-white/92">{output}</p>
      )}
    </div>
  );
}

function RunDetailsModal({ run, onClose }: { run: WorkflowRun; onClose: () => void }) {
  const [copiedNodeId, setCopiedNodeId] = useState<string>();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md" onClick={onClose}>
      <div
        className="studio-scrollbar max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[30px] border border-white/10 bg-[#111111] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-secondary">Run Inspector</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-white">{scopeToLabel(run.scope)}</h2>
            <p className="mt-2 text-sm leading-7 text-secondary">{run.summary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/8 p-2 text-white transition-colors hover:bg-white/12"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/8 bg-white/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">Status</p>
            <div className="mt-3">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusToTone(run.status)}`}>{run.status}</span>
            </div>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">Started</p>
            <p className="mt-3 text-sm text-white">{formatTimestamp(run.startedAt)}</p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">Duration</p>
            <p className="mt-3 text-sm text-white">{formatDuration(run.durationMs)}</p>
          </div>
        </div>

        <div className="space-y-4">
          {run.nodeRuns.map((nodeRun) => (
            <div key={`${run.id}-${nodeRun.nodeId}`} className="rounded-[24px] border border-white/8 bg-white/5 p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-white">{nodeRun.nodeLabel}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-secondary">{nodeRun.nodeType}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusToTone(nodeRun.status)}`}>{nodeRun.status}</span>
              </div>

              <div className="mb-4 flex items-center justify-between text-xs text-secondary">
                <span>{formatDuration(nodeRun.executionMs)}</span>
                <span>{nodeRun.inputs.length} input note{nodeRun.inputs.length > 1 ? "s" : ""}</span>
              </div>

              {!["uploadImage", "uploadVideo", "text"].includes(nodeRun.nodeType) ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  {nodeRun.inputs.map((input) => (
                    <span key={input} className="rounded-full border border-white/8 bg-white/6 px-3 py-1.5 text-[11px] text-secondary">
                      {input}
                    </span>
                  ))}
                </div>
              ) : null}

              {nodeRun.nodeType === "runLLM" && nodeRun.output && !isImageOutput(nodeRun.output) && !isVideoOutput(nodeRun.output) ? (
                <div className="mb-4 flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(nodeRun.output ?? "");
                      setCopiedNodeId(nodeRun.nodeId);
                      window.setTimeout(() => {
                        setCopiedNodeId((current) => (current === nodeRun.nodeId ? undefined : current));
                      }, 1600);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-white/12"
                  >
                    {copiedNodeId === nodeRun.nodeId ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedNodeId === nodeRun.nodeId ? "Copied" : "Copy"}
                  </button>
                </div>
              ) : null}

              {!["uploadImage", "uploadVideo", "text"].includes(nodeRun.nodeType) && nodeRun.output ? (
                <OutputPreview output={nodeRun.output} nodeType={nodeRun.nodeType} />
              ) : null}

              {nodeRun.error ? (
                <div className="mt-4 rounded-[20px] border border-red-400/18 bg-red-500/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-200">Error</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-red-100">{nodeRun.error}</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StudioInner() {
  const reactFlow = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workflowNameInputRef = useRef<HTMLInputElement>(null);
  const historyPanelRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const [showGuide, setShowGuide] = useState(false);
  const [deployMessage, setDeployMessage] = useState("");
  const [openRunId, setOpenRunId] = useState<string>();
  const [isRenamingWorkflow, setIsRenamingWorkflow] = useState(false);
  const [draftWorkflowName, setDraftWorkflowName] = useState("");

  const {
    workflowName,
    currentWorkflowId,
    workflows,
    nodes,
    edges,
    runs,
    selectedRunId,
    selectedNodeIds,
    initialize,
    createWorkflow,
    selectWorkflow,
    deleteWorkflow,
    renameWorkflow,
    loadSampleWorkflow,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    addNodeAtPosition,
    setSelectedNodeIds,
    setSelectedRunId,
    runWorkflow,
    runSelected,
    exportWorkflow,
    importWorkflow,
    undo,
    redo,
  } = useWorkflowStudioStore();

  const openRun = useMemo(() => runs.find((run) => run.id === openRunId), [runs, openRunId]);

  useEffect(() => {
    if (initialized.current) {
      return;
    }
    initialize();
    initialized.current = true;
  }, [initialize]);

  useEffect(() => {
    if (isRenamingWorkflow) {
      workflowNameInputRef.current?.focus();
      workflowNameInputRef.current?.select();
    }
  }, [isRenamingWorkflow]);

  const commitWorkflowRename = () => {
    renameWorkflow(draftWorkflowName);
    setIsRenamingWorkflow(false);
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#e7e5e4]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/6 bg-black/70 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <p className="text-xl font-bold tracking-[-0.08em] text-stone-200">NextFlow AI</p>
            <div className="hidden items-center gap-6 text-sm md:flex">
              <button type="button" className="border-b border-stone-200 pb-1 font-medium text-stone-100">
                Editor
              </button>
              <Link href="/" className="font-medium text-stone-500 transition-colors hover:text-stone-300">
                Home
              </Link>
              <button type="button" className="font-medium text-stone-500 transition-colors hover:text-stone-300" onClick={() => loadSampleWorkflow(workflowTemplates[0]?.id)}>
                Library
              </button>
              <button
                type="button"
                className="font-medium text-stone-500 transition-colors hover:text-stone-300"
                onClick={() => historyPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
              >
                History
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {deployMessage ? <span className="hidden text-[10px] uppercase tracking-[0.18em] text-stone-500 md:inline">{deployMessage}</span> : null}
            <button className="rounded-sm px-4 py-1.5 text-xs font-medium text-stone-500 transition-colors hover:bg-white/5 hover:text-stone-300" onClick={() => downloadJson("nextflow-workflow.json", exportWorkflow())}>
              Export JSON
            </button>
            <button className="rounded-sm px-4 py-1.5 text-xs font-medium text-stone-500 transition-colors hover:bg-white/5 hover:text-stone-300" onClick={() => fileInputRef.current?.click()}>
              Import JSON
            </button>
            <button className="rounded-sm bg-[#c7c7bc] px-5 py-1.5 text-xs font-bold text-[#404139] transition-colors hover:bg-[#d7d7cb]" onClick={() => setDeployMessage("Deploy will come in a future release.")}>
              Deploy
            </button>
          </div>
        </div>
      </header>

      <div className="flex pt-14">
        <aside className="studio-scrollbar fixed bottom-0 left-0 top-14 z-40 flex w-[292px] flex-col overflow-y-auto border-r border-white/6 bg-[#111111] p-4">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-stone-200">Workflow Studio</h2>
            <p className="mt-1 text-[11px] text-stone-500">Realtime Editor</p>
          </div>

          <div className="mt-5 rounded-[22px] border border-white/8 bg-[#151515] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Workflow</p>
                {isRenamingWorkflow ? (
                  <input
                    ref={workflowNameInputRef}
                    value={draftWorkflowName}
                    onChange={(event) => setDraftWorkflowName(event.target.value)}
                    onBlur={commitWorkflowRename}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitWorkflowRename();
                      }

                      if (event.key === "Escape") {
                        setDraftWorkflowName(workflowName);
                        setIsRenamingWorkflow(false);
                      }
                    }}
                    className="mt-3 w-full bg-transparent text-2xl font-semibold tracking-[-0.06em] text-white outline-none"
                  />
                ) : (
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.06em] text-white">{workflowName}</p>
                )}
              </div>

              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 transition-colors hover:bg-[#202020] hover:text-white"
                onClick={() => {
                  setDraftWorkflowName(workflowName);
                  setIsRenamingWorkflow(true);
                }}
                title="Rename workflow"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>

            {isRenamingWorkflow ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-[#202020] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#262626]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={commitWorkflowRename}
                >
                  Save Name
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-400 transition-colors hover:bg-[#1b1b1b] hover:text-white"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setDraftWorkflowName(workflowName);
                    setIsRenamingWorkflow(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : null}

            <button
              type="button"
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1f1f1f] text-sm font-semibold text-white transition-colors hover:bg-[#262626]"
              onClick={createWorkflow}
              title="New workflow"
            >
              <Plus className="h-4 w-4" />
              New Workflow
            </button>

            <p className="mt-3 text-xs leading-5 text-stone-500">
              Start from scratch or pull in a starter flow for image generation, product cutdowns, or social capture.
            </p>
          </div>

          <div className="mt-4 rounded-[22px] border border-white/8 bg-[#151515] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Your Workflows</p>
                <span className="rounded-full bg-[#202020] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                  {workflows.length}
                </span>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 transition-colors hover:bg-[#202020] hover:text-red-400"
                onClick={() => deleteWorkflow(currentWorkflowId)}
                title="Delete workflow"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {workflows.map((workflow) => (
                <button
                  key={workflow.id}
                  type="button"
                  onClick={() => selectWorkflow(workflow.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                    workflow.id === currentWorkflowId ? "border-white/12 bg-[#1b1b1b]" : "border-white/8 bg-[#151515] hover:bg-[#1a1a1a]"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{workflow.name}</p>
                  <p className="mt-1 text-xs text-stone-500">{workflow.nodes.length} nodes</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-[22px] border border-white/8 bg-[#151515] p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Templates</p>
              <span className="rounded-full bg-[#202020] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                {workflowTemplates.length}
              </span>
            </div>

            <div className="space-y-2">
              {workflowTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => loadSampleWorkflow(template.id)}
                  className="w-full rounded-xl border border-white/8 bg-[#151515] px-3 py-3 text-left transition-colors hover:bg-[#1a1a1a]"
                >
                  <p className="text-sm font-semibold text-white">{template.name}</p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">{template.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex-1 rounded-[22px] border border-white/8 bg-[#151515] p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Node Palette</p>
              <span className="rounded-full bg-[#202020] px-2 py-0.5 text-xs text-white">{quickAccess.length} nodes</span>
            </div>

            <div className="space-y-2">
              {quickAccess.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/nextflow-node", item.type);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => addNode(item.type)}
                  className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left text-stone-400 transition-all hover:border-white/8 hover:bg-[#1a1a1a] hover:text-white"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-[#1b1b1b] text-white">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{item.label}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-stone-500">Add node</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex gap-2 border-t border-white/6 pt-4">
            <button
              type="button"
              className="flex-1 rounded-xl bg-[#1f1f1f] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#262626]"
              onClick={runSelected}
            >
              <Play className="mr-2 inline h-4 w-4" />
              Run Selected
            </button>
            <button
              type="button"
              className="rounded-xl bg-[#1f1f1f] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#262626]"
              onClick={() => downloadJson(`${workflowName || "workflow"}.json`, exportWorkflow())}
            >
              <Save className="h-4 w-4" />
            </button>
          </div>
        </aside>

        <main className="ml-[292px] mr-[292px] h-[calc(100vh-56px)] flex-1 overflow-hidden bg-[#0e0e0e]">
          <section className="relative h-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_28%),#0e0e0e]">
            <div className="absolute left-6 top-6 z-10 flex items-center gap-2 rounded-xl border border-white/8 bg-[#191a1a]/80 px-4 py-2 shadow-2xl backdrop-blur-xl">
              <div className="h-2 w-2 rounded-full bg-[#6dfe9c]" />
              <div>
                <p className="text-xs font-bold tracking-tight text-white">{workflowName || "Untitled workflow"}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">{nodes.length} nodes active</p>
              </div>
              <div className="mx-2 h-5 w-px bg-white/8" />
              <button className="text-stone-400 transition-colors hover:text-white" onClick={runWorkflow}>
                <Play className="h-4 w-4" />
              </button>
              <button className="text-stone-400 transition-colors hover:text-white" onClick={undo}>
                <Undo2 className="h-4 w-4" />
              </button>
              <button className="text-stone-400 transition-colors hover:text-white" onClick={redo}>
                <Redo2 className="h-4 w-4" />
              </button>
              <div className="mx-1 h-5 w-px bg-white/8" />
              <button
                type="button"
                onClick={() => setShowGuide((current) => !current)}
                className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                  showGuide ? "bg-white text-black" : "bg-white/8 text-white hover:bg-white/12"
                }`}
              >
                {showGuide ? "Hide Guide" : "Guide"}
              </button>
            </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            nodesDraggable
            nodesConnectable
            elementsSelectable
            deleteKeyCode={["Backspace", "Delete"]}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={({ nodes: selectedNodes }) => {
              const ids = selectedNodes.map((node) => node.id);
              setSelectedNodeIds(ids);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const type = event.dataTransfer.getData("application/nextflow-node") as WorkflowNodeType | "";
              if (!type) {
                return;
              }
              const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
              addNodeAtPosition(type, position.x, position.y);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.09)" />
            <MiniMap pannable zoomable nodeStrokeColor="rgba(255,255,255,0.12)" nodeColor="rgba(255,255,255,0.24)" maskColor="rgba(0,0,0,0.25)" />
            <Controls position="bottom-left" />
          </ReactFlow>

          {showGuide ? (
            <div className="absolute left-6 top-24 z-10 max-w-sm rounded-[26px] border border-white/8 bg-black/40 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-secondary">Canvas Guide</p>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="rounded-full bg-white/8 p-2 text-white transition-colors hover:bg-white/12"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h3 className="mt-3 text-lg font-semibold tracking-[-0.04em] text-white">Build from scratch or load a template when you need a head start.</h3>
              <p className="mt-3 text-sm leading-7 text-secondary">
                Add nodes from the left, connect valid inputs and outputs, and run the workflow when you&apos;re ready.
              </p>
              {selectedNodeIds.length ? (
                <p className="mt-3 text-xs font-medium text-white">{selectedNodeIds.length} node(s) selected for partial execution.</p>
              ) : null}
            </div>
          ) : null}
          </section>
        </main>

        <aside ref={historyPanelRef} className="studio-scrollbar fixed bottom-0 right-0 top-14 z-40 flex w-[292px] flex-col overflow-y-auto border-l border-white/6 bg-[#111111]">
          <div className="border-b border-white/6 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500">Workflow Info</p>
            <div className="mt-4 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-stone-200">{workflowName || "Untitled workflow"}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-stone-500">Build multimodal pipelines with prompt nodes, image generation, frame extraction, and LLM summarization.</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-[18px] border border-white/8 bg-[#151515] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-stone-500">Total Nodes</p>
                  <p className="mt-2 text-lg font-bold text-stone-200">{nodes.length}</p>
                </div>
                <div className="rounded-[18px] border border-white/8 bg-[#151515] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-stone-500">Workflows</p>
                  <p className="mt-2 text-lg font-bold text-stone-200">{workflows.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col min-h-0">
            <div className="px-4 py-4">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500">Recent Executions</h3>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-5">
              {runs.length === 0 ? (
                <div className="rounded-[20px] border border-white/8 bg-[#151515] p-4 text-sm leading-7 text-stone-500">No runs yet. Run the workflow to populate execution history.</div>
              ) : null}
              {runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => {
                    setSelectedRunId(run.id);
                    setOpenRunId(run.id);
                  }}
                  className={`group w-full rounded-[20px] border p-3 text-left transition-colors ${
                    selectedRunId === run.id ? "border-[#6dfe9c]/30 bg-[#171717]" : "border-white/8 bg-[#151515] hover:border-white/14"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <span className="text-[10px] font-mono text-stone-500">#{run.id.slice(4, 10).toUpperCase()}</span>
                    <span className={`rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] ${statusToTone(run.status)}`}>{run.status}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium text-stone-300">{scopeToLabel(run.scope)}</p>
                      <p className="mt-1 text-[10px] text-stone-500">{formatDuration(run.durationMs)} · {formatTimestamp(run.startedAt)}</p>
                    </div>
                    <span className="text-stone-600 transition-colors group-hover:text-stone-300">›</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {openRun ? <RunDetailsModal run={openRun} onClose={() => setOpenRunId(undefined)} /> : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }
          const text = await file.text();
          importWorkflow(JSON.parse(text));
          event.target.value = "";
        }}
      />
    </div>
  );
}

export function WorkflowStudio() {
  return (
    <ReactFlowProvider>
      <StudioInner />
    </ReactFlowProvider>
  );
}
