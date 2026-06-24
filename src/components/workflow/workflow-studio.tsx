"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  BookOpen,
  Calculator,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Command,
  Copy,
  Download,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Map,
  Move,
  Play,
  Plus,
  Redo2,
  Search,
  Undo2,
  Wallet,
  ZoomIn,
  ZoomOut,
  Loader2,
} from "lucide-react";
import { cn, formatDuration, formatTimestamp } from "@/lib/utils";
import { scopeToLabel, statusToTone } from "@/lib/workflow-utils";
import { nodeTypes } from "@/components/workflow/nodes";
import { useWorkflowStudioStore } from "@/components/workflow/workflow-store";
import type { WorkflowNodeType, NodeRun } from "@/types/workflow";
import { CustomDeletableEdge } from "./custom-edge";

const edgeTypes = {
  default: CustomDeletableEdge,
};



// ─── Tooltip ────────────────────────────────────────────────────────────────
function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-1.5 rounded-lg bg-[#111827] px-2.5 py-1.5 shadow-lg">
            <span className="whitespace-nowrap text-[11px] font-medium text-white">{label}</span>
          </div>
          <div className="mx-auto w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#111827]" />
        </div>
      )}
    </div>
  );
}

// ─── LeftRail ────────────────────────────────────────────────────────────────
function LeftRail() {
  return (
    <aside className="absolute inset-y-0 left-0 z-30 flex w-14 flex-col items-center border-r border-[#ececec] bg-[#fafafa] py-5">
      <div className="mb-6 flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="Nextflow" className="h-full w-full object-cover" />
      </div>
    </aside>
  );
}

// ─── AddNodePicker ───────────────────────────────────────────────────────────
const ADD_NODE_CATEGORIES = [
  {
    title: "ALL NODES",
    icon: <LayoutGrid className="h-4 w-4" />,
    items: [
      { type: "request", title: "Request Input", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> },
      { type: "cropImage", title: "Crop Image", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6.13 1L6 16a2 2 0 002 2h15" /><path strokeLinecap="round" strokeLinejoin="round" d="M1 6.13L16 6a2 2 0 012 2v15" /></svg> },
      { type: "gemini", title: "Gemini 2.5 Flash", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg> },
    ],
  },
];

function AddNodePicker({
  query,
  onQueryChange,
  onSelect,
  onClose,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (type: WorkflowNodeType | string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 w-[280px] overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur z-50 flex flex-col"
      style={{ maxHeight: 430 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search nodes or models..."
              className="w-full rounded-xl bg-transparent py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-400"
              autoFocus
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {ADD_NODE_CATEGORIES.map((category) => (
          <div key={category.title} className="mb-4 last:mb-0">
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-500">
              <span className="text-gray-500 [&>svg]:h-4 [&>svg]:w-4">{category.icon}</span>
              <span>{category.title}</span>
            </div>
            <div className="mt-1 space-y-0.5">
              {category.items.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => {
                    onSelect(item.type);
                    onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {"icon" in item && <span className="text-gray-500">{(item as any).icon}</span>}
                    <span>{item.title}</span>
                  </div>
                  {"trailingIcon" in item && (item as any).trailingIcon}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Custom Filter Dropdown ──────────────────────────────────────────────────
const FILTER_OPTIONS = ["All", "Queued", "Running", "Waiting", "Completed", "Failed", "Canceled"];

function FilterDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
      >
        {value}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-32 rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-gray-800 hover:bg-gray-50 transition-colors"
            >
              <span className="w-3.5 flex-shrink-0 flex items-center justify-center">
                {opt === value && <Check className="h-3.5 w-3.5 text-gray-900" />}
              </span>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HistoryDrawer ───────────────────────────────────────────────────────────
// ─── HistoryDrawer Helpers ───────────────────────────────────────────────────
function CopyButtonInline({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy output"}
      className="cursor-pointer rounded p-0.5 text-[#9ca3af] hover:text-[#6366f1] transition-colors"
    >
      {copied
        ? <Check className="h-3 w-3 text-emerald-500" strokeWidth={2.5} />
        : <Copy className="h-3 w-3" />}
    </button>
  );
}

function DownloadButton({ url, filename }: { url: string; filename: string }) {
  return (
    <a
      href={url}
      download={filename}
      target="_blank"
      rel="noopener noreferrer"
      title="Download image"
      className="cursor-pointer rounded p-0.5 text-[#9ca3af] hover:text-[#6366f1] transition-colors"
    >
      <Download className="h-3 w-3" />
    </a>
  );
}

const isImageOutput = (nodeRun: NodeRun) => {
  return (
    nodeRun.nodeType === "cropImage" ||
    (typeof nodeRun.output === "string" &&
      (nodeRun.output.startsWith("data:image/") ||
        /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(nodeRun.output)))
  );
};

// ─── HistoryDrawer ───────────────────────────────────────────────────────────
function HistoryDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const runs = useWorkflowStudioStore((state) => state.runs);
  const [expandedRunId, setExpandedRunId] = useState<string | undefined>();
  const [expandedNodeId, setExpandedNodeId] = useState<string | undefined>();
  const [filter, setFilter] = useState<string>("All");

  const filteredRuns =
    filter === "All" ? runs : runs.filter((r) => r.status.toLowerCase() === filter.toLowerCase());

  return (
    <aside
      className={cn(
        "absolute inset-y-0 right-0 z-40 h-full min-h-0 w-[360px] border-l border-gray-200 bg-gray-50 shadow-xl transition-transform duration-300 ease-in-out dark:border-zinc-700 dark:bg-zinc-900",
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-gray-900">Execution History</div>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors hover:bg-gray-100 h-8 rounded-[18px] px-3 text-xs"
            >
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="text-xs font-medium text-gray-600">Run history</div>
            <FilterDropdown value={filter} onChange={setFilter} />
          </div>

          <div className="space-y-2">
            {filteredRuns.length === 0 ? (
              <div className="rounded-xl border border-[#e8eaed] bg-white p-6 text-center">
                <p className="text-[12px] text-[#9ca3af]">No runs for this filter yet.</p>
              </div>
            ) : (
              filteredRuns.map((run) => (
                <div key={run.id} className="rounded-xl border border-[#e8eaed] bg-white p-3">
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedRunId(expandedRunId === run.id ? undefined : run.id);
                      setExpandedNodeId(undefined);
                    }}
                    className="cursor-pointer w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] font-semibold text-[#111827] uppercase">
                          {scopeToLabel(run.scope)}
                        </span>
                        <p className="mt-0.5 text-[10px] text-[#9ca3af]">
                          {formatTimestamp(run.startedAt)} · {formatDuration(run.durationMs)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold", statusToTone(run.status))}>
                          {run.status}
                        </span>
                        <ChevronDown
                          className={cn("h-3 w-3 text-[#c4c9d4] transition-transform", expandedRunId === run.id ? "rotate-180" : "")}
                        />
                      </div>
                    </div>
                  </button>

                  {expandedRunId === run.id && (
                    <div className="mt-2 space-y-1.5 border-l-2 border-[#e8eaed] pl-3">
                      {run.nodes.length === 0 ? (
                        <div className="text-[10px] text-[#c4c9d4]">No node data</div>
                      ) : (
                        run.nodes.map((nodeRun) => (
                          <div
                            key={nodeRun.id || nodeRun.nodeId}
                            className="rounded-lg bg-[#f9fafb] p-2 border border-[#e8eaed] text-[10px]"
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedNodeId(expandedNodeId === nodeRun.nodeId ? undefined : nodeRun.nodeId)}
                              className="cursor-pointer w-full text-left"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-[#374151]">{nodeRun.nodeLabel}</p>
                                  <p className="text-[9px] text-[#9ca3af] mt-0.5">
                                    {nodeRun.nodeType} · {nodeRun.executionMs}ms
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className={cn("flex-shrink-0 rounded px-1.5 py-0.5 font-semibold text-[9px]", statusToTone(nodeRun.status))}>
                                    {nodeRun.status.substring(0, 3)}
                                  </span>
                                  <ChevronDown className={cn("h-3 w-3 text-[#c4c9d4] transition-transform", expandedNodeId === nodeRun.nodeId ? "rotate-180" : "")} />
                                </div>
                              </div>
                            </button>

                            {expandedNodeId === nodeRun.nodeId && (
                              <div className="mt-2 pt-2 border-t border-[#e8eaed] space-y-2 text-[9px] text-[#4b5563]">
                                {nodeRun.inputs && nodeRun.inputs.length > 0 && (
                                  <div>
                                    <div className="font-semibold text-[#111827]">Inputs:</div>
                                    <ul className="list-disc list-inside mt-0.5 pl-1 space-y-0.5 text-gray-600">
                                      {nodeRun.inputs.map((input, idx) => (
                                        <li key={idx} className="truncate" title={input}>{input}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {nodeRun.output && (
                                  <div>
                                    <div className="flex items-center justify-between font-semibold text-[#111827] mb-1">
                                      <span>Output:</span>
                                      {isImageOutput(nodeRun) ? (
                                        <DownloadButton url={nodeRun.output} filename={`${nodeRun.nodeLabel || "cropped"}.png`} />
                                      ) : (
                                        <CopyButtonInline text={nodeRun.output} />
                                      )}
                                    </div>
                                    {isImageOutput(nodeRun) ? (
                                      <div className="mt-0.5 border border-[#e8eaed] rounded overflow-hidden max-h-24 bg-white flex items-center justify-center">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={nodeRun.output} alt="Output Preview" className="max-h-24 object-contain" />
                                      </div>
                                    ) : (
                                      <div className="mt-0.5 p-1.5 bg-white border border-[#e8eaed] rounded font-mono text-[9px] text-gray-700 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                                        {nodeRun.output}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {nodeRun.error && (
                                  <div>
                                    <div className="font-semibold text-red-600">Error:</div>
                                    <div className="mt-0.5 p-1.5 bg-red-50 text-red-700 border border-red-100 rounded font-mono text-[9px] whitespace-pre-wrap break-all">
                                      {nodeRun.error}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── StudioInner ─────────────────────────────────────────────────────────────
function StudioInner() {
  const params = useParams<{ workflowId?: string }>();
  const reactFlow = useReactFlow();
  const initialized = useRef(false);
  const workflowNameInputRef = useRef<HTMLInputElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [workflowNameDraft, setWorkflowNameDraft] = useState("");
  const [showMinimap, setShowMinimap] = useState(true);
  const [zoomLabel, setZoomLabel] = useState("50%");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification]);

  const {
    workflowName,
    currentWorkflowId,
    workflows,
    nodes,
    edges,
    selectedNodeIds,
    initialize,
    selectWorkflow,
    renameWorkflow,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNodeAtPosition,
    addNode,
    setSelectedNodeIds,
    runWorkflow,
    runSelected,
    undo,
    redo,
    undoStack,
    redoStack,
  } = useWorkflowStudioStore();

  useEffect(() => {
    if (initialized.current) return;
    initialize();
    initialized.current = true;
  }, [initialize]);

  useEffect(() => {
    const workflowId = params?.workflowId;
    if (!workflowId || workflowId === currentWorkflowId) return;
    if (workflows.some((workflow) => workflow.id === workflowId)) {
      selectWorkflow(workflowId);
    }
  }, [currentWorkflowId, params, selectWorkflow, workflows]);

  useEffect(() => {
    setWorkflowNameDraft(workflowName);
  }, [workflowName]);

  const commitWorkflowName = () => {
    renameWorkflow(workflowNameDraft);
  };

  const viewportChanged = () => {
    setZoomLabel(`${Math.round(reactFlow.getZoom() * 100)}%`);
  };

  const selectedCountLabel = useMemo(() => {
    if (!selectedNodeIds.length) return "Run workflow";
    return `Run ${selectedNodeIds.length} selected`;
  }, [selectedNodeIds.length]);

  const estimatedTimeStr = useMemo(() => {
    const totalSeconds = nodes.reduce((acc, node) => {
      const type = node.type || node.data?.nodeType;
      if (type === "gemini") return acc + 10.;
      if (type === "cropImage") return acc + 30.0;
      if (type === "request") return acc + 0.1;
      if (type === "response") return acc + 0.1;
      return acc;
    }, 0);

    if (totalSeconds < 60) {
      return `${totalSeconds.toFixed(1)}s`;
    }
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.round(totalSeconds % 60);
    return `${mins}m ${secs}s`;
  }, [nodes]);

  const isWorkflowRunning = useMemo(() => {
    return nodes.some((node) => node.data?.running === true);
  }, [nodes]);

  return (
    <div className="relative h-screen overflow-hidden bg-[#f4f4f4] text-[#111827] dark:bg-zinc-950">

      <div
        className="absolute inset-0 left-0 transition-all duration-300 ease-in-out"
        style={{ right: historyOpen ? 360 : 0 }}
      >
        {/* Top-left: back + workflow name */}
        <div className="absolute left-4 top-4 z-30 pointer-events-none">
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white/85 px-2 py-1.5 shadow-md backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/85">
            <Link
              href="/workflows"
              className="inline-flex cursor-pointer h-8 w-8 items-center justify-center rounded-xl border border-[#e5e7eb] bg-white text-[#111827] hover:bg-[#f9fafb] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <input
              ref={workflowNameInputRef}
              value={workflowNameDraft}
              onChange={(event) => setWorkflowNameDraft(event.target.value)}
              onBlur={commitWorkflowName}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              placeholder="Untitled"
              maxLength={120}
              className="h-8 w-[120px] sm:w-[160px] bg-transparent text-[14px] font-normal text-[#111827] dark:text-white outline-none placeholder:text-gray-400 truncate"
            />
          </div>
        </div>

        {/* Top-right: Est, Bal, Run, Clock */}
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
          <span className="hidden sm:inline-flex">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-gray-200 bg-white/90 px-2.5 text-[11px] font-medium text-gray-700 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200">
              <Calculator className="h-3.5 w-3.5" />
              <span className="text-gray-500 dark:text-zinc-400">Est</span>
              <span className="tabular-nums">{estimatedTimeStr}</span>
            </span>
          </span>
          <span className="hidden sm:inline-flex">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-gray-200 bg-white/90 px-2.5 text-[11px] font-medium text-gray-700 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200">
              <Wallet className="h-3.5 w-3.5" />
              <span className="text-gray-500 dark:text-zinc-400">Bal</span>
              <span className="tabular-nums">0.00</span>
              <span className="text-gray-500 dark:text-zinc-400">M</span>
            </span>
          </span>
          <div className="group relative">
            <button
              type="button"
              disabled={isWorkflowRunning}
              onClick={async () => {
                setHistoryOpen(true);
                try {
                  let result;
                  if (selectedNodeIds.length) {
                    result = await runSelected();
                  } else {
                    result = await runWorkflow();
                  }
                  if (result?.status === "failed") {
                    setNotification({
                      message: `Workflow run failed: ${result.summary || "One or more nodes failed."}`,
                      type: "error",
                    });
                  } else {
                    setNotification({
                      message: "Workflow run completed successfully!",
                      type: "success",
                    });
                  }
                } catch (err) {
                  setNotification({
                    message: `Execution error: ${err instanceof Error ? err.message : String(err)}`,
                    type: "error",
                  });
                }
              }}
              className="cursor-pointer flex h-8 w-9 items-center justify-center rounded-lg border border-[#818cf8] bg-[#6366f1] text-white shadow-sm transition-all hover:bg-[#5558e3] disabled:opacity-50 disabled:cursor-not-allowed dark:border-[#818cf8] dark:bg-[#6366f1]"
              title={isWorkflowRunning ? "Running workflow..." : selectedCountLabel}
            >
              {isWorkflowRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" />
              )}
            </button>
          </div>
          {/* Clock – only visible when history is CLOSED */}
          {!historyOpen && (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#111827] shadow-sm transition-colors hover:bg-[#f9fafb] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
              title="Show execution history"
            >
              <Clock3 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Canvas */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          deleteKeyCode={["Backspace", "Delete"]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onMoveEnd={viewportChanged}
          onSelectionChange={({ nodes: selectedNodes }) => setSelectedNodeIds(selectedNodes.map((node) => node.id))}
          onDrop={(event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData("application/nextflow-node") as WorkflowNodeType | "";
            if (!type) return;
            const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
            addNodeAtPosition(type, position.x, position.y);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={true}
          nodesConnectable={true}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={15.5} size={1.25} color="#d1d1d1" />
          {showMinimap && (
            <MiniMap
              className="!absolute !bottom-4 !right-4 !m-0 !border !border-gray-200 !bg-white/95 !shadow-sm !rounded-xl dark:!border-zinc-700 dark:!bg-zinc-900/95"
              nodeClassName={(node) => `minimap-node-${node.type}`}
              nodeColor={(node) => {
                if (node.type === "request") return "#f59e0b";
                if (node.type === "gemini") return "#6366f1";
                if (node.type === "cropImage") return "#ec4899";
                if (node.type === "response") return "#22c55e";
                return "#d1d5db";
              }}
              maskColor="rgba(0, 0, 0, 0.6)"
              zoomable
              pannable
            />
          )}
        </ReactFlow>

        {/* Toggle minimap button */}
        <button
          type="button"
          onClick={() => setShowMinimap((s) => !s)}
          className="absolute rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 shadow-sm transition-all hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 z-20"
          title={showMinimap ? "Hide minimap" : "Show minimap"}
          style={{
            bottom: showMinimap ? 172 : 16,
            right: 16,
          }}
        >
          {showMinimap ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Map className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Bottom-left: control panel */}
        <div className="absolute bottom-4 left-4 z-30 flex items-center">
          <div
            className={cn(
              "flex items-center gap-0.5 rounded-xl border border-gray-200 bg-white px-1 py-1 shadow-sm md:gap-1 md:px-2 md:py-1.5 transition-all duration-200 dark:border-zinc-700 dark:bg-zinc-900/95",
              controlsCollapsed ? "w-auto" : "",
            )}
          >
            {/* Collapse toggle */}
            <Tooltip label={controlsCollapsed ? "Expand controls" : "Collapse controls"}>
              <button
                type="button"
                onClick={() => setControlsCollapsed((c) => !c)}
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform duration-200", controlsCollapsed ? "rotate-180" : "")} />
              </button>
            </Tooltip>

            {!controlsCollapsed && (
              <>
                <div className="mx-0.5 h-5 w-px bg-gray-200 dark:bg-zinc-700" />

                <Tooltip label="Undo">
                  <button
                    type="button"
                    disabled={undoStack.length === 0}
                    onClick={undo}
                    className={cn(
                      "rounded-lg p-2 transition-colors",
                      undoStack.length === 0
                        ? "cursor-not-allowed text-gray-300 dark:text-zinc-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white",
                    )}
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>

                <Tooltip label="Redo">
                  <button
                    type="button"
                    disabled={redoStack.length === 0}
                    onClick={redo}
                    className={cn(
                      "rounded-lg p-2 transition-colors",
                      redoStack.length === 0
                        ? "cursor-not-allowed text-gray-300 dark:text-zinc-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white",
                    )}
                  >
                    <Redo2 className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>

                <Tooltip label="Command menu">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    <Command className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>

                <div className="mx-0.5 h-5 w-px bg-gray-200 dark:bg-zinc-700" />

                <Tooltip label="Zoom out">
                  <button
                    type="button"
                    onClick={() => {
                      const newZoom = Math.max(0.1, reactFlow.getZoom() - 0.1);
                      reactFlow.setViewport({ ...reactFlow.getViewport(), zoom: newZoom });
                      viewportChanged();
                    }}
                    className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>

                <span className="min-w-[40px] text-center text-xs font-medium text-gray-500 dark:text-zinc-400 tabular-nums">
                  {zoomLabel}
                </span>

                <Tooltip label="Zoom in">
                  <button
                    type="button"
                    onClick={() => {
                      const newZoom = Math.min(2, reactFlow.getZoom() + 0.1);
                      reactFlow.setViewport({ ...reactFlow.getViewport(), zoom: newZoom });
                      viewportChanged();
                    }}
                    className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>

                <div className="mx-0.5 h-5 w-px bg-gray-200 dark:bg-zinc-700" />

                <Tooltip label="Fit view">
                  <button
                    type="button"
                    onClick={() => reactFlow.fitView({ padding: 0.2 }).then(viewportChanged)}
                    className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>

                <Tooltip label="Grid layout">
                  <button
                    type="button"
                    className="hidden rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 md:block dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>

                <Tooltip label="Pan mode">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    <Move className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        {/* Bottom-center: docs + add node */}
        <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2">
          <div className="flex items-center gap-1 overflow-visible rounded-xl border border-[#e5e7eb] bg-white px-2 py-1.5 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
            <Tooltip label="Add sticky Notes">
              <button type="button" className="cursor-pointer rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white">
                <BookOpen className="h-4 w-4" />
              </button>
            </Tooltip>
            <div className="relative">
              <Tooltip label="Add node">
                <button
                  type="button"
                  onClick={() => setPickerOpen((c) => !c)}
                  className="cursor-pointer rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </Tooltip>
              {pickerOpen && (
                <AddNodePicker
                  query={pickerQuery}
                  onQueryChange={setPickerQuery}
                  onSelect={(type) => {
                    addNode(type as WorkflowNodeType);
                    setPickerOpen(false);
                    setPickerQuery("");
                  }}
                  onClose={() => {
                    setPickerOpen(false);
                    setPickerQuery("");
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Execution History */}
      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} />

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2 transform transition-all duration-300 animate-in fade-in slide-in-from-top-4">
          <div className={cn(
            "flex items-center gap-2.5 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md transition-all duration-300",
            notification.type === "error"
              ? "border-red-200 bg-red-50/95 text-red-800 dark:border-red-900/50 dark:bg-red-950/95 dark:text-red-200"
              : "border-green-200 bg-green-50/95 text-green-800 dark:border-green-900/50 dark:bg-green-950/95 dark:text-green-200"
          )}>
            {notification.type === "error" ? (
              <svg className="h-5 w-5 text-red-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-green-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            <span className="text-[13px] font-semibold tracking-wide">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <svg className="h-4 w-4 opacity-65" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
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
