"use client";

import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange } from "@xyflow/react";
import { create } from "zustand";
import { sampleEdges, sampleNodes, workflowTemplates } from "@/lib/workflow-sample";
import {
  buildResponseItems,
  canConnect,
  createBlankWorkflowNodes,
  createNodeTemplate,
  getIncomingValue,
  resolveWorkflowNodes,
  styleEdge,
} from "@/lib/workflow-utils";
import type {
  RequestField,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeType,
  WorkflowRun,
  WorkflowRunScope,
  NodeRun,
} from "@/types/workflow";

type Snapshot = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

type WorkflowRecord = {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  runs: WorkflowRun[];
  createdAt: string;
  updatedAt: string;
};

type WorkflowState = {
  workflowName: string;
  currentWorkflowId: string;
  workflows: WorkflowRecord[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  runs: WorkflowRun[];
  selectedRunId?: string;
  selectedNodeIds: string[];
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  initialize: () => void;
  createWorkflow: () => string;
  selectWorkflow: (id: string) => void;
  deleteWorkflow: (id: string) => void;
  duplicateWorkflow: (id: string) => string;
  renameWorkflow: (name: string) => void;
  renameWorkflowById: (id: string, name: string) => void;
  loadSampleWorkflow: (templateId?: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  updateNodeData: (id: string, patch: Partial<WorkflowNodeData>) => void;
  addRequestField: (nodeId: string, type: RequestField["type"]) => void;
  updateRequestField: (nodeId: string, fieldId: string, patch: Partial<RequestField>) => void;
  removeRequestField: (nodeId: string, fieldId: string) => void;
  addNode: (type: WorkflowNodeType) => void;
  addNodeAtPosition: (type: WorkflowNodeType, x: number, y: number) => void;
  removeNode: (id: string) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setSelectedRunId: (id?: string) => void;
  runWorkflow: () => Promise<WorkflowRun>;
  runSelected: () => Promise<WorkflowRun>;
  runSingleNode: (id: string) => Promise<WorkflowRun>;
  exportWorkflow: () => { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  importWorkflow: (name: string, nodes: WorkflowNode[], edges: WorkflowEdge[]) => string;
  undo: () => void;
  redo: () => void;
};

const STORAGE_KEY = "nextflow-studio-v4";

async function cropImageHelper(
  imageUrl: string,
  xPercent: string,
  yPercent: string,
  widthPercent: string,
  heightPercent: string
): Promise<string> {
  if (typeof window === "undefined") return imageUrl;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        const x = (parseFloat(xPercent) / 100) * img.width;
        const y = (parseFloat(yPercent) / 100) * img.height;
        const w = (parseFloat(widthPercent) / 100) * img.width;
        const h = (parseFloat(heightPercent) / 100) * img.height;

        canvas.width = w;
        canvas.height = h;

        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        const croppedDataUrl = canvas.toDataURL("image/png");
        resolve(croppedDataUrl);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error("Failed to load image for cropping"));
    };
    img.src = imageUrl;
  });
}

function clearTargetHandlesForEdges(nodes: WorkflowNode[], edgesToRemove: WorkflowEdge[]): WorkflowNode[] {
  let nextNodes = [...nodes];
  for (const edge of edgesToRemove) {
    nextNodes = nextNodes.map((node) => {
      if (node.id !== edge.target) return node;

      // Use type-safe narrowing per node type to avoid union assignment errors
      if (node.data.nodeType === "gemini") {
        const geminiData = { ...node.data };
        if (edge.targetHandle === "image_vision") geminiData.imageInput = "";
        else if (edge.targetHandle === "prompt") geminiData.prompt = "";
        else if (edge.targetHandle === "system_prompt") geminiData.systemPrompt = "";
        return { ...node, data: geminiData };
      }

      if (node.data.nodeType === "cropImage") {
        const cropData = { ...node.data };
        if (edge.targetHandle === "input_image") {
          cropData.imageUrl = "";
          cropData.outputImage = "";
        } else if (edge.targetHandle === "x_percent") {
          cropData.xPercent = "0";
        } else if (edge.targetHandle === "y_percent") {
          cropData.yPercent = "0";
        } else if (edge.targetHandle === "width_percent") {
          cropData.widthPercent = "100";
        } else if (edge.targetHandle === "height_percent") {
          cropData.heightPercent = "100";
        }
        return { ...node, data: cropData };
      }

      return node;
    }) as WorkflowNode[];
  }
  return nextNodes;
}

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function snapshot(state: WorkflowState): Snapshot {
  return {
    nodes: structuredClone(state.nodes),
    edges: structuredClone(state.edges),
  };
}

function finalizeGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const styledEdges = edges.map((edge) => styleEdge(edge, nodes));
  const resolvedNodes = resolveWorkflowNodes(nodes, styledEdges);

  return {
    nodes: resolvedNodes,
    edges: styledEdges,
  };
}

function createWorkflowRecord(name: string, variant: "sample" | "blank"): WorkflowRecord {
  const now = new Date().toISOString();

  if (variant === "sample") {
    return {
      id: "sample-workflow-id",
      name,
      nodes: structuredClone(sampleNodes),
      edges: structuredClone(sampleEdges),
      runs: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  const blankNodes = createBlankWorkflowNodes();
  const graph = finalizeGraph(blankNodes, []);

  return {
    id: crypto.randomUUID(),
    name,
    nodes: graph.nodes,
    edges: graph.edges,
    runs: [],
    createdAt: now,
    updatedAt: now,
  };
}

function hydrateWorkflow(workflow: WorkflowRecord) {
  // Always start with running:false to avoid stale state from DB or localStorage
  const safeNodes = workflow.nodes.map((node) => ({
    ...node,
    data: { ...node.data, running: false },
  }));
  const graph = finalizeGraph(safeNodes, workflow.edges);

  return {
    workflowName: workflow.name,
    currentWorkflowId: workflow.id,
    nodes: graph.nodes,
    edges: graph.edges,
    runs: workflow.runs,
    selectedRunId: workflow.runs[0]?.id,
    selectedNodeIds: [],
    undoStack: [],
    redoStack: [],
  };
}

function persist(workflows: WorkflowRecord[], currentWorkflowId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      workflows,
      currentWorkflowId,
    }),
  );
}

function syncWorkflow(state: WorkflowState, next: { workflowName?: string; nodes?: WorkflowNode[]; edges?: WorkflowEdge[]; runs?: WorkflowRun[] }, skipPersist = false) {
  const workflowName = next.workflowName ?? state.workflowName;
  const nodes = next.nodes ?? state.nodes;
  const edges = next.edges ?? state.edges;
  const runs = next.runs ?? state.runs;
  const updatedAt = new Date().toISOString();

  const workflows = state.workflows.map((workflow) =>
    workflow.id === state.currentWorkflowId
      ? {
          ...workflow,
          name: workflowName,
          nodes: structuredClone(nodes),
          edges: structuredClone(edges),
          runs: structuredClone(runs),
          updatedAt,
        }
      : workflow,
  );

  if (!skipPersist) {
    persist(workflows, state.currentWorkflowId);
    
    // Save to DB in background
    fetch(`/api/workflows/${state.currentWorkflowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodesJson: nodes,
        edgesJson: edges,
      }),
    }).catch(err => console.error("Failed to sync workflow content to DB:", err));
  }

  return {
    workflows,
    workflowName,
    nodes,
    edges,
    runs,
  };
}

function formatRunSummary(scope: WorkflowRunScope, status: WorkflowRun["status"]) {
  if (status === "failed") {
    return "One or more nodes need required inputs before the workflow can complete.";
  }

  if (scope === "single") {
    return "Single node run completed.";
  }

  if (scope === "selected") {
    return "Selected nodes run completed.";
  }

  return "Workflow run completed.";
}

function buildLevels(nodes: WorkflowNode[], edges: WorkflowEdge[], targetIds?: string[]) {
  const targetSet = targetIds?.length ? new Set(targetIds) : new Set(nodes.map((node) => node.id));
  const activeNodes = nodes.filter((node) => targetSet.has(node.id));
  const indegree = new Map(activeNodes.map((node) => [node.id, 0]));
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    if (!targetSet.has(edge.source) || !targetSet.has(edge.target)) {
      continue;
    }

    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }

  const queue = activeNodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const levels: string[][] = [];

  while (queue.length > 0) {
    const currentLevel = [...queue];
    levels.push(currentLevel);
    queue.length = 0;

    for (const id of currentLevel) {
      for (const next of adjacency.get(id) ?? []) {
        indegree.set(next, (indegree.get(next) ?? 1) - 1);
        if ((indegree.get(next) ?? 0) === 0) {
          queue.push(next);
        }
      }
    }
  }

  return levels.length ? levels : [activeNodes.map((node) => node.id)];
}

async function executeNode(node: WorkflowNode, nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const started = Date.now();

  if (node.data.nodeType === "request") {
    return {
      node,
      run: {
        nodeId: node.id,
        nodeLabel: node.data.label,
        nodeType: node.data.nodeType,
        status: "success" as const,
        executionMs: Date.now() - started,
        inputs: node.data.fields.map((field) => field.label),
      },
    };
  }

  if (node.data.nodeType === "cropImage") {
    const imageUrl = getIncomingValue(edges, nodes, node.id, "input_image") ?? node.data.imageUrl;
    if (!imageUrl) {
      return {
        node: {
          ...node,
          data: {
            ...node.data,
            imageUrl,
            outputImage: "",
            running: false,
          },
        },
        run: {
          nodeId: node.id,
          nodeLabel: node.data.label,
          nodeType: node.data.nodeType,
          status: "failed" as const,
          executionMs: Date.now() - started,
          inputs: ["Image input missing"],
          error: "Input image is required.",
        },
      };
    }

    // Validate image URL is accessible before proceeding
    if (imageUrl.startsWith("http")) {
      try {
        const checkRes = await fetch(imageUrl, { method: "HEAD" });
        if (!checkRes.ok) {
          return {
            node: {
              ...node,
              data: { ...node.data, imageUrl, outputImage: "", running: false },
            },
            run: {
              nodeId: node.id,
              nodeLabel: node.data.label,
              nodeType: node.data.nodeType,
              status: "failed" as const,
              executionMs: Date.now() - started,
              inputs: [imageUrl],
              error: `Image URL returned HTTP ${checkRes.status}. Please check the URL.`,
            },
          };
        }
        const ct = checkRes.headers.get("content-type") ?? "";
        if (!ct.startsWith("image/")) {
          return {
            node: {
              ...node,
              data: { ...node.data, imageUrl, outputImage: "", running: false },
            },
            run: {
              nodeId: node.id,
              nodeLabel: node.data.label,
              nodeType: node.data.nodeType,
              status: "failed" as const,
              executionMs: Date.now() - started,
              inputs: [imageUrl],
              error: `URL does not point to a valid image (content-type: ${ct || "unknown"}).`,
            },
          };
        }
      } catch {
        return {
          node: {
            ...node,
            data: { ...node.data, imageUrl, outputImage: "", running: false },
          },
          run: {
            nodeId: node.id,
            nodeLabel: node.data.label,
            nodeType: node.data.nodeType,
            status: "failed" as const,
            executionMs: Date.now() - started,
            inputs: [imageUrl],
            error: "Failed to reach image URL. Please check your network or URL.",
          },
        };
      }
    }

    // 30+ second artificial delay (mandatory as per deliverables)
    await new Promise((resolve) => setTimeout(resolve, 30000));

    let outputImage = "";
    let cropError: string | undefined;
    try {
      const xPercent = getIncomingValue(edges, nodes, node.id, "x_percent") ?? node.data.xPercent;
      const yPercent = getIncomingValue(edges, nodes, node.id, "y_percent") ?? node.data.yPercent;
      const widthPercent = getIncomingValue(edges, nodes, node.id, "width_percent") ?? node.data.widthPercent;
      const heightPercent = getIncomingValue(edges, nodes, node.id, "height_percent") ?? node.data.heightPercent;

      outputImage = await cropImageHelper(
        imageUrl,
        xPercent || "0",
        yPercent || "0",
        widthPercent || "100",
        heightPercent || "100"
      );
    } catch (err) {
      console.error("Failed to crop image dynamically:", err);
      cropError = err instanceof Error ? err.message : String(err);
    }

    if (cropError) {
      return {
        node: {
          ...node,
          data: {
            ...node.data,
            imageUrl,
            outputImage: "",
            running: false,
          },
        },
        run: {
          nodeId: node.id,
          nodeLabel: node.data.label,
          nodeType: node.data.nodeType,
          status: "failed" as const,
          executionMs: Date.now() - started,
          inputs: [`x=${node.data.xPercent} y=${node.data.yPercent} w=${node.data.widthPercent} h=${node.data.heightPercent}`],
          error: `Failed to load or crop image: ${cropError}`,
        },
      };
    }

    return {
      node: {
        ...node,
        data: {
          ...node.data,
          imageUrl,
          outputImage,
          running: false,
        },
      },
      run: {
        nodeId: node.id,
        nodeLabel: node.data.label,
        nodeType: node.data.nodeType,
        status: "success" as const,
        executionMs: Date.now() - started,
        inputs: [`x=${node.data.xPercent} y=${node.data.yPercent} w=${node.data.widthPercent} h=${node.data.heightPercent}`],
        output: outputImage,
      },
    };
  }

  if (node.data.nodeType === "gemini") {
    const prompt = getIncomingValue(edges, nodes, node.id, "prompt") ?? node.data.prompt;
    const systemPrompt = getIncomingValue(edges, nodes, node.id, "system_prompt") ?? node.data.systemPrompt;
    const imageInput = getIncomingValue(edges, nodes, node.id, "image_vision") ?? node.data.imageInput;

    if (!prompt.trim()) {
      return {
        node: {
          ...node,
          data: {
            ...node.data,
            prompt,
            systemPrompt,
            imageInput,
            response: "",
            running: false,
          },
        },
        run: {
          nodeId: node.id,
          nodeLabel: node.data.label,
          nodeType: node.data.nodeType,
          status: "failed" as const,
          executionMs: Date.now() - started,
          inputs: ["Prompt missing"],
          error: "Prompt is required.",
        },
      };
    }

    let response = "";
    let status: "success" | "failed" = "success";
    let error: string | undefined;

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: node.data.model || "gemini-2.5-flash",
          prompt,
          systemPrompt: systemPrompt || undefined,
          imageInput: imageInput || undefined,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        response = data.output || "";
      } else {
        status = "failed";
        error = data.error || "Gemini API call failed.";
        response = `Error: ${error}`;
      }
    } catch (err) {
      status = "failed";
      error = err instanceof Error ? err.message : "Network error calling Gemini API.";
      response = `Error: ${error}`;
    }

    return {
      node: {
        ...node,
        data: {
          ...node.data,
          prompt,
          systemPrompt,
          imageInput,
          response,
          running: false,
        },
      },
      run: {
        nodeId: node.id,
        nodeLabel: node.data.label,
        nodeType: node.data.nodeType,
        status,
        executionMs: Date.now() - started,
        inputs: [prompt, imageInput ? "1 image connected" : "No image connected"],
        output: response,
        error,
      },
    };
  }

  const items = buildResponseItems(edges, nodes, node.id);
  return {
    node: {
      ...node,
      data: {
        ...node.data,
        items,
        running: false,
      },
    },
    run: {
      nodeId: node.id,
      nodeLabel: node.data.label,
      nodeType: node.data.nodeType,
      status: items.length ? ("success" as const) : ("failed" as const),
      executionMs: Date.now() - started,
      inputs: items.map((item) => item.sourceNodeLabel),
      output: items[0]?.value,
      error: items.length ? undefined : "Response node has no connected result.",
    },
  };
}

async function executeWorkflow(
  runId: string,
  scope: WorkflowRunScope,
  targetIds: string[] | undefined,
  state: WorkflowState,
  onNodesChange: (nodes: WorkflowNode[]) => void,
  onRunUpdate: (updatedFields: Partial<WorkflowRun>) => void
) {
  const startedAt = new Date();
  let workingNodes = structuredClone(state.nodes);
  const levels = buildLevels(workingNodes, state.edges, targetIds);
  const currentRunNodes: NodeRun[] = [];

  // Reset all nodes to running: false initially
  workingNodes = workingNodes.map((node) => ({
    ...node,
    data: { ...node.data, running: false },
  }));
  onNodesChange(workingNodes);

  for (const level of levels) {
    // Mark only nodes in the current level as running: true
    workingNodes = workingNodes.map((node) =>
      level.includes(node.id)
        ? { ...node, data: { ...node.data, running: true } }
        : { ...node, data: { ...node.data, running: false } }
    );
    onNodesChange(workingNodes);

    // Add running entries in execution history in real-time
    for (const id of level) {
      const node = workingNodes.find((item) => item.id === id);
      if (node) {
        currentRunNodes.push({
          nodeId: node.id,
          nodeLabel: node.data.label,
          nodeType: node.data.nodeType,
          status: "running",
          executionMs: 0,
          inputs: [],
        });
      }
    }
    onRunUpdate({
      durationMs: Date.now() - startedAt.getTime(),
      nodes: [...currentRunNodes],
    });

    const levelRuns = await Promise.all(
      level.map(async (id) => {
        const node = workingNodes.find((item) => item.id === id);
        if (!node) {
          return undefined;
        }

        const executed = await executeNode(node, workingNodes, state.edges);

        // Update execution history in real time for this node
        const idx = currentRunNodes.findIndex((rn) => rn.nodeId === id);
        if (idx !== -1) {
          currentRunNodes[idx] = {
            ...currentRunNodes[idx],
            status: executed.run.status,
            executionMs: executed.run.executionMs,
            inputs: executed.run.inputs || [],
            output: executed.run.output,
            error: executed.run.error,
          };
        }
        onRunUpdate({
          durationMs: Date.now() - startedAt.getTime(),
          nodes: [...currentRunNodes],
        });

        return { id, executed };
      }),
    );

    // Apply executed data and clear running state for completed nodes
    for (const result of levelRuns) {
      if (!result) continue;
      workingNodes = workingNodes.map((item) =>
        item.id === result.id ? { ...result.executed.node, data: { ...result.executed.node.data, running: false } } : item
      );
    }
    
    workingNodes = resolveWorkflowNodes(workingNodes, state.edges);
    onNodesChange(workingNodes);

    // If any node in the current level failed, abort subsequent levels
    const levelHasFailure = levelRuns.some((result) => result?.executed.run.status === "failed");
    if (levelHasFailure) {
      break;
    }
  }

  const finishedNodes = resolveWorkflowNodes(
    workingNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        running: false,
      },
    })),
    state.edges,
  );

  const status = currentRunNodes.some((rn) => rn.status === "failed") ? "failed" : "success";

  const run: WorkflowRun = {
    id: runId,
    workflowId: state.currentWorkflowId,
    scope,
    status,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    summary: formatRunSummary(scope, status),
    nodes: currentRunNodes,
  };

  return {
    nodes: finishedNodes,
    run,
  };
}

export const useWorkflowStudioStore = create<WorkflowState>((set, get) => {
  const initial = createWorkflowRecord("Sample Workflow", "sample");

  return {
    workflowName: initial.name,
    currentWorkflowId: initial.id,
    workflows: [initial],
    nodes: initial.nodes,
    edges: initial.edges,
    runs: [],
    selectedRunId: undefined,
    selectedNodeIds: [],
    undoStack: [],
    redoStack: [],

    initialize: async () => {
      // 1. Immediately load workflows and active ID from localStorage (synchronously before any network fetches)
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      let localWorkflows: WorkflowRecord[] = [];
      let localCurrentId = "";
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          localWorkflows = parsed.workflows || [];
          localCurrentId = parsed.currentWorkflowId || "";
        } catch(e) {}
      }

      // Check if sample workflow exists in localWorkflows; if not, prepend it
      const sampleExists = localWorkflows.some((w) => w.id === "sample-workflow-id");
      if (!sampleExists) {
        localWorkflows = [initial, ...localWorkflows];
      }

      // Check if there is a workflowId in the URL pathname
      let urlWorkflowId = "";
      if (typeof window !== "undefined") {
        const match = window.location.pathname.match(/\/workflows\/([^\/]+)/);
        if (match) {
          urlWorkflowId = match[1];
        }
      }

      const activeId = urlWorkflowId || localCurrentId;

      if (localWorkflows.length > 0) {
        const selected = localWorkflows.find((w) => w.id === activeId) || localWorkflows[0];
        set({
          workflows: localWorkflows,
          ...hydrateWorkflow(selected),
        });
      }

      // 2. Fetch the latest from the database in the background to sync
      try {
        const res = await fetch("/api/workflows");
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.workflows) {
            const dbWorkflows: WorkflowRecord[] = await Promise.all(data.workflows.map(async (w: any) => {
              let runs = [];
              try {
                const runsRes = await fetch(`/api/workflows/${w.id}/runs`);
                if (runsRes.ok) {
                  const runsData = await runsRes.json();
                  if (runsData.ok) runs = runsData.runs || [];
                }
              } catch(e) {}

              return {
                id: w.id,
                name: w.name,
                nodes: typeof w.nodesJson === 'string' ? JSON.parse(w.nodesJson) : w.nodesJson,
                edges: typeof w.edgesJson === 'string' ? JSON.parse(w.edgesJson) : w.edgesJson,
                runs,
                createdAt: w.createdAt,
                updatedAt: w.updatedAt,
              };
            }));

            if (dbWorkflows.length > 0) {
              const mergedWorkflows = [...dbWorkflows];
              for (const lw of localWorkflows) {
                if (!dbWorkflows.some((dw) => dw.id === lw.id)) {
                  mergedWorkflows.push(lw);
                }
              }

              const currentId = get().currentWorkflowId || activeId;
              const selected = mergedWorkflows.find((w) => w.id === currentId) || mergedWorkflows[0];
              
              // Only re-hydrate if the current workflow changed (avoid flash for already-correct workflow)
              const currentState = get();
              const needsRehydrate = currentState.currentWorkflowId !== selected.id;
              
              set({
                workflows: mergedWorkflows,
                ...(needsRehydrate ? hydrateWorkflow(selected) : { runs: selected.runs }),
              });
              persist(mergedWorkflows, selected.id);
              return;
            }
          }
        }
      } catch (e) {
        console.error("DB initialize failed, falling back to localStorage:", e);
      }

      // Fallback if DB fetch is empty/failed and localStorage was also empty
      if (localWorkflows.length === 0) {
        persist([initial], initial.id);
        set({
          workflows: [initial],
          ...hydrateWorkflow(initial),
        });
      }
    },

    createWorkflow: () => {
      const workflow = createWorkflowRecord(`Workflow ${get().workflows.length + 1}`, "blank");
      set((state) => {
        const workflows = [...state.workflows, workflow];
        persist(workflows, workflow.id);

        // Save to DB in background
        fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: workflow.id,
            userId: "anonymous",
            name: workflow.name,
            nodesJson: workflow.nodes,
            edgesJson: workflow.edges,
          }),
        }).catch(err => console.error("Failed to save new workflow to DB:", err));

        return {
          workflows,
          ...hydrateWorkflow(workflow),
        };
      });
      return workflow.id;
    },

    selectWorkflow: (id) =>
      set((state) => {
        if (state.currentWorkflowId === id) {
          return state;
        }

        const synced = syncWorkflow(state, {});
        const workflow = synced.workflows.find((item) => item.id === id);
        if (!workflow) {
          return state;
        }

        persist(synced.workflows, workflow.id);
        return {
          workflows: synced.workflows,
          ...hydrateWorkflow(workflow),
        };
      }),

    deleteWorkflow: (id) =>
      set((state) => {
        const remaining = state.workflows.filter((workflow) => workflow.id !== id);
        const workflows = remaining.length ? remaining : [createWorkflowRecord("Workflow 1", "blank")];
        const nextWorkflow = workflows[0];
        persist(workflows, nextWorkflow.id);

        // Delete from DB in background
        fetch(`/api/workflows/${id}`, {
          method: "DELETE",
        }).catch(err => console.error("Failed to delete workflow from DB:", err));

        return {
          workflows,
          ...hydrateWorkflow(nextWorkflow),
        };
      }),

    duplicateWorkflow: (id) => {
      const state = get();
      const source = state.workflows.find((w) => w.id === id);
      if (!source) return "";

      const newId = crypto.randomUUID();
      const newName = `${source.name} Copy`;
      const now = new Date().toISOString();
      const cleanNodes = structuredClone(source.nodes).map((node) => {
        if (node.data.nodeType === "cropImage") {
          return {
            ...node,
            data: {
              ...node.data,
              outputImage: "",
            },
          };
        }
        if (node.data.nodeType === "gemini") {
          return {
            ...node,
            data: {
              ...node.data,
              response: "",
            },
          };
        }
        if (node.data.nodeType === "response") {
          return {
            ...node,
            data: {
              ...node.data,
              items: node.data.items.map((item) => ({ ...item, value: "" })),
            },
          };
        }
        return node;
      });

      const duplicated: WorkflowRecord = {
        id: newId,
        name: newName,
        nodes: cleanNodes,
        edges: structuredClone(source.edges),
        runs: [],
        createdAt: now,
        updatedAt: now,
      };

      set((state) => {
        const workflows = [...state.workflows, duplicated];
        persist(workflows, state.currentWorkflowId);

        // Save to DB in background
        fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: duplicated.id,
            userId: "anonymous",
            name: duplicated.name,
            nodesJson: duplicated.nodes,
            edgesJson: duplicated.edges,
          }),
        }).catch(err => console.error("Failed to save duplicated workflow to DB:", err));

        return { workflows };
      });

      return newId;
    },

    renameWorkflow: (name) =>
      set((state) => {
        const trimmed = name.trim() || "Untitled workflow";
        // Update in DB
        fetch(`/api/workflows/${state.currentWorkflowId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        }).catch(err => console.error("Failed to rename workflow in DB:", err));

        return syncWorkflow(state, { workflowName: trimmed });
      }),

    renameWorkflowById: (id, name) =>
      set((state) => {
        const trimmed = name.trim() || "Untitled workflow";
        const workflows = state.workflows.map((workflow) =>
          workflow.id === id
            ? { ...workflow, name: trimmed, updatedAt: new Date().toISOString() }
            : workflow,
        );
        persist(workflows, state.currentWorkflowId);

        // Update in DB
        fetch(`/api/workflows/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        }).catch(err => console.error("Failed to rename workflow in DB:", err));

        return {
          workflows,
          workflowName: state.currentWorkflowId === id ? trimmed : state.workflowName,
        };
      }),

    loadSampleWorkflow: (templateId) =>
      set((state) => {
        const template = workflowTemplates.find((item) => item.id === templateId) ?? workflowTemplates[0];
        const graph = finalizeGraph(structuredClone(template.nodes), structuredClone(template.edges));
        const synced = syncWorkflow(state, {
          workflowName: template.name,
          nodes: graph.nodes,
          edges: graph.edges,
          runs: [],
        });
        return {
          ...synced,
          selectedRunId: undefined,
          selectedNodeIds: [],
          undoStack: [],
          redoStack: [],
        };
      }),

    onNodesChange: (changes) =>
      set((state) => {
        const isDragging = changes.some((c) => c.type === "position" && (c as any).dragging === true);
        const isSelectionOnly = changes.every((c) => c.type === "select");
        const skipPersist = isDragging || isSelectionOnly;

        const graph = finalizeGraph(applyNodeChanges(changes, state.nodes) as WorkflowNode[], state.edges);
        const synced = syncWorkflow(state, graph, skipPersist);

        if (skipPersist) {
          return {
            ...synced,
          };
        }

        return {
          ...synced,
          undoStack: [...state.undoStack, snapshot(state)],
          redoStack: [],
        };
      }),

    onEdgesChange: (changes) =>
      set((state) => {
        const removedEdgeIds = changes
          .filter((c) => c.type === "remove")
          .map((c) => c.id);
        const removedEdges = state.edges.filter((edge) => removedEdgeIds.includes(edge.id));
        const cleanedNodes = clearTargetHandlesForEdges(state.nodes, removedEdges);

        const graph = finalizeGraph(cleanedNodes, applyEdgeChanges(changes, state.edges));
        const synced = syncWorkflow(state, graph);
        return {
          ...synced,
          undoStack: [...state.undoStack, snapshot(state)],
          redoStack: [],
        };
      }),

    onConnect: (connection) =>
      set((state) => {
        if (!canConnect(connection, state.nodes, state.edges)) {
          return state;
        }

        const nextEdge = styleEdge(
          {
            ...connection,
            id: `edge-${crypto.randomUUID()}`,
          } as WorkflowEdge,
          state.nodes,
        );
        const graph = finalizeGraph(state.nodes, addEdge(nextEdge, state.edges));
        const synced = syncWorkflow(state, graph);
        return {
          ...synced,
          undoStack: [...state.undoStack, snapshot(state)],
          redoStack: [],
        };
      }),

    updateNodeData: (id, patch) =>
      set((state) => {
        const nextNodes = state.nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...patch,
                },
              }
            : node,
        ) as WorkflowNode[];
        const graph = finalizeGraph(nextNodes, state.edges);
        const synced = syncWorkflow(state, graph);
        return {
          ...synced,
          undoStack: [...state.undoStack, snapshot(state)],
          redoStack: [],
        };
      }),

    addRequestField: (nodeId, type) =>
      set((state) => {
        const nextNodes = state.nodes.map((node) =>
          node.id === nodeId && node.data.nodeType === "request"
            ? {
                ...node,
                data: {
                  ...node.data,
                  fields: [
                    ...node.data.fields,
                    {
                      id: `field_${crypto.randomUUID()}`,
                      type,
                      label: type === "image_field" ? `image_field_${node.data.fields.length}` : `text_field_${node.data.fields.length}`,
                      value: "",
                    },
                  ],
                },
              }
            : node,
        ) as WorkflowNode[];
        const graph = finalizeGraph(nextNodes, state.edges);
        const synced = syncWorkflow(state, graph);
        return { ...synced, undoStack: [...state.undoStack, snapshot(state)], redoStack: [] };
      }),

    updateRequestField: (nodeId, fieldId, patch) =>
      set((state) => {
        const nextNodes = state.nodes.map((node) =>
          node.id === nodeId && node.data.nodeType === "request"
            ? {
                ...node,
                data: {
                  ...node.data,
                  fields: node.data.fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)),
                },
              }
            : node,
        ) as WorkflowNode[];
        const graph = finalizeGraph(nextNodes, state.edges);
        const synced = syncWorkflow(state, graph);
        return { ...synced, undoStack: [...state.undoStack, snapshot(state)], redoStack: [] };
      }),

    removeRequestField: (nodeId, fieldId) =>
      set((state) => {
        const nextNodes = state.nodes.map((node) =>
          node.id === nodeId && node.data.nodeType === "request"
            ? {
                ...node,
                data: {
                  ...node.data,
                  fields: node.data.fields.filter((field) => field.id !== fieldId),
                },
              }
            : node,
        ) as WorkflowNode[];
        const edgesToRemove = state.edges.filter((edge) => edge.source === nodeId && edge.sourceHandle === fieldId);
        const cleanedNodes = clearTargetHandlesForEdges(nextNodes, edgesToRemove);
        const nextEdges = state.edges.filter((edge) => !(edge.source === nodeId && edge.sourceHandle === fieldId));
        const graph = finalizeGraph(cleanedNodes, nextEdges);
        const synced = syncWorkflow(state, graph);
        return { ...synced, undoStack: [...state.undoStack, snapshot(state)], redoStack: [] };
      }),

    addNode: (type) =>
      set((state) => {
        const nextNodes = [...state.nodes, createNodeTemplate(type, state.nodes.length)];
        const graph = finalizeGraph(nextNodes, state.edges);
        const synced = syncWorkflow(state, graph);
        return { ...synced, undoStack: [...state.undoStack, snapshot(state)], redoStack: [] };
      }),

    addNodeAtPosition: (type, x, y) =>
      set((state) => {
        const node = createNodeTemplate(type, state.nodes.length);
        node.position = { x, y };
        const graph = finalizeGraph([...state.nodes, node], state.edges);
        const synced = syncWorkflow(state, graph);
        return { ...synced, undoStack: [...state.undoStack, snapshot(state)], redoStack: [] };
      }),

    removeNode: (id) =>
      set((state) => {
        const node = state.nodes.find((item) => item.id === id);
        if (!node) {
          return state;
        }

        const nextNodes = state.nodes.filter((item) => item.id !== id);
        const edgesToRemove = state.edges.filter((edge) => edge.source === id);
        const cleanedNodes = clearTargetHandlesForEdges(nextNodes, edgesToRemove);

        const nextEdges = state.edges.filter((edge) => edge.source !== id && edge.target !== id);
        const graph = finalizeGraph(cleanedNodes, nextEdges);
        const synced = syncWorkflow(state, graph);
        return { ...synced, undoStack: [...state.undoStack, snapshot(state)], redoStack: [] };
      }),

    setSelectedNodeIds: (ids) =>
      set((state) => (sameIds(state.selectedNodeIds, ids) ? state : { selectedNodeIds: ids })),

    setSelectedRunId: (id) =>
      set((state) => (state.selectedRunId === id ? state : { selectedRunId: id })),

    runWorkflow: async () => {
      const current = get();
      const runId = `run-${crypto.randomUUID()}`;
      const startedAt = new Date().toISOString();
      const initialRun: WorkflowRun = {
        id: runId,
        workflowId: current.currentWorkflowId,
        scope: "full",
        status: "running",
        startedAt,
        durationMs: 0,
        summary: "Running workflow...",
        nodes: [],
      };

      set((state) => {
        const runs = [initialRun, ...state.runs];
        const synced = syncWorkflow(state, { runs });
        return { ...synced, selectedRunId: runId };
      });

      const onRunUpdate = (updatedFields: Partial<WorkflowRun>) => {
        set((state) => {
          const runs = state.runs.map((r) => r.id === runId ? { ...r, ...updatedFields } : r);
          const synced = syncWorkflow(state, { runs }, true);
          return synced;
        });
      };

      try {
        const result = await executeWorkflow(runId, "full", undefined, current, (updatedNodes) => {
          set(syncWorkflow(get(), { nodes: updatedNodes }));
        }, onRunUpdate);
        
        // Save run to DB in background
        fetch(`/api/workflows/${current.currentWorkflowId}/runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.run),
        }).catch(err => console.error("Failed to save run to DB:", err));

        set((state) => {
          const runs = state.runs.map((r) => r.id === runId ? result.run : r);
          const synced = syncWorkflow(state, { nodes: result.nodes, runs });
          return { ...synced, selectedRunId: runId };
        });

        return result.run;
      } catch (err) {
        const failedRun: WorkflowRun = {
          ...initialRun,
          status: "failed",
          durationMs: Date.now() - new Date(startedAt).getTime(),
          summary: `Execution error: ${err instanceof Error ? err.message : String(err)}`,
        };
        set((state) => {
          const runs = state.runs.map((r) => r.id === runId ? failedRun : r);
          const clearedNodes = state.nodes.map((node) => ({
            ...node,
            data: { ...node.data, running: false },
          }));
          return syncWorkflow(state, { nodes: clearedNodes, runs });
        });
        throw err;
      }
    },

    runSelected: async () => {
      const current = get();
      const targetIds = current.selectedNodeIds.length ? current.selectedNodeIds : current.nodes.map((node) => node.id);
      const runId = `run-${crypto.randomUUID()}`;
      const startedAt = new Date().toISOString();
      const initialRun: WorkflowRun = {
        id: runId,
        workflowId: current.currentWorkflowId,
        scope: "selected",
        status: "running",
        startedAt,
        durationMs: 0,
        summary: "Running selected nodes...",
        nodes: [],
      };

      set((state) => {
        const runs = [initialRun, ...state.runs];
        const synced = syncWorkflow(state, { runs });
        return { ...synced, selectedRunId: runId };
      });

      const onRunUpdate = (updatedFields: Partial<WorkflowRun>) => {
        set((state) => {
          const runs = state.runs.map((r) => r.id === runId ? { ...r, ...updatedFields } : r);
          const synced = syncWorkflow(state, { runs }, true);
          return synced;
        });
      };

      try {
        const result = await executeWorkflow(runId, "selected", targetIds, current, (updatedNodes) => {
          set(syncWorkflow(get(), { nodes: updatedNodes }));
        }, onRunUpdate);

        // Save run to DB in background
        fetch(`/api/workflows/${current.currentWorkflowId}/runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.run),
        }).catch(err => console.error("Failed to save run to DB:", err));

        set((state) => {
          const runs = state.runs.map((r) => r.id === runId ? result.run : r);
          const synced = syncWorkflow(state, { nodes: result.nodes, runs });
          return { ...synced, selectedRunId: runId };
        });

        return result.run;
      } catch (err) {
        const failedRun: WorkflowRun = {
          ...initialRun,
          status: "failed",
          durationMs: Date.now() - new Date(startedAt).getTime(),
          summary: `Execution error: ${err instanceof Error ? err.message : String(err)}`,
        };
        set((state) => {
          const runs = state.runs.map((r) => r.id === runId ? failedRun : r);
          const clearedNodes = state.nodes.map((node) => ({
            ...node,
            data: { ...node.data, running: false },
          }));
          return syncWorkflow(state, { nodes: clearedNodes, runs });
        });
        throw err;
      }
    },

    runSingleNode: async (id) => {
      const current = get();
      const runId = `run-${crypto.randomUUID()}`;
      const startedAt = new Date().toISOString();
      const initialRun: WorkflowRun = {
        id: runId,
        workflowId: current.currentWorkflowId,
        scope: "single",
        status: "running",
        startedAt,
        durationMs: 0,
        summary: "Running single node...",
        nodes: [],
      };

      set((state) => {
        const runs = [initialRun, ...state.runs];
        const synced = syncWorkflow(state, { runs });
        return { ...synced, selectedRunId: runId };
      });

      const onRunUpdate = (updatedFields: Partial<WorkflowRun>) => {
        set((state) => {
          const runs = state.runs.map((r) => r.id === runId ? { ...r, ...updatedFields } : r);
          const synced = syncWorkflow(state, { runs }, true);
          return synced;
        });
      };

      try {
        const result = await executeWorkflow(runId, "single", [id], current, (updatedNodes) => {
          set(syncWorkflow(get(), { nodes: updatedNodes }));
        }, onRunUpdate);

        // Save run to DB in background
        fetch(`/api/workflows/${current.currentWorkflowId}/runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.run),
        }).catch(err => console.error("Failed to save run to DB:", err));

        set((state) => {
          const runs = state.runs.map((r) => r.id === runId ? result.run : r);
          const synced = syncWorkflow(state, { nodes: result.nodes, runs });
          return { ...synced, selectedRunId: runId };
        });

        return result.run;
      } catch (err) {
        const failedRun: WorkflowRun = {
          ...initialRun,
          status: "failed",
          durationMs: Date.now() - new Date(startedAt).getTime(),
          summary: `Execution error: ${err instanceof Error ? err.message : String(err)}`,
        };
        set((state) => {
          const runs = state.runs.map((r) => r.id === runId ? failedRun : r);
          const clearedNodes = state.nodes.map((node) => ({
            ...node,
            data: { ...node.data, running: false },
          }));
          return syncWorkflow(state, { nodes: clearedNodes, runs });
        });
        throw err;
      }
    },

    exportWorkflow: () => ({ nodes: get().nodes, edges: get().edges }),

    importWorkflow: (name, nodes, edges) => {
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      const workflow: WorkflowRecord = {
        id: newId,
        name: name || "Imported Workflow",
        nodes: nodes || [],
        edges: edges || [],
        runs: [],
        createdAt: now,
        updatedAt: now,
      };

      set((state) => {
        const workflows = [...state.workflows, workflow];
        persist(workflows, state.currentWorkflowId);

        // Save to DB in background
        fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: workflow.id,
            userId: "anonymous",
            name: workflow.name,
            nodesJson: workflow.nodes,
            edgesJson: workflow.edges,
          }),
        }).catch(err => console.error("Failed to save imported workflow to DB:", err));

        return { workflows };
      });

      return newId;
    },

    undo: () =>
      set((state) => {
        const previous = state.undoStack[state.undoStack.length - 1];
        if (!previous) {
          return state;
        }

        const graph = finalizeGraph(previous.nodes, previous.edges);
        const synced = syncWorkflow(state, graph);
        return {
          ...synced,
          undoStack: state.undoStack.slice(0, -1),
          redoStack: [...state.redoStack, snapshot(state)],
        };
      }),

    redo: () =>
      set((state) => {
        const next = state.redoStack[state.redoStack.length - 1];
        if (!next) {
          return state;
        }

        const graph = finalizeGraph(next.nodes, next.edges);
        const synced = syncWorkflow(state, graph);
        return {
          ...synced,
          redoStack: state.redoStack.slice(0, -1),
          undoStack: [...state.undoStack, snapshot(state)],
        };
      }),
  };
});
