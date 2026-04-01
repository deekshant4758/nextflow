"use client";

import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange } from "@xyflow/react";
import { create } from "zustand";
import { workflowTemplates } from "@/lib/workflow-sample";
import { materializeMediaOutputs } from "@/lib/client-media";
import { canConnect, createNodeTemplate, getIncomingValue, getIncomingValues } from "@/lib/workflow-utils";
import type { WorkflowEdge, WorkflowNode, WorkflowNodeData, WorkflowNodeType, WorkflowRun, WorkflowRunScope } from "@/types/workflow";

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
  createWorkflow: () => void;
  selectWorkflow: (id: string) => void;
  deleteWorkflow: (id: string) => void;
  renameWorkflow: (name: string) => void;
  loadSampleWorkflow: (templateId?: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  updateNodeData: (id: string, patch: Partial<WorkflowNodeData>) => void;
  addNode: (type: WorkflowNodeType) => void;
  addNodeAtPosition: (type: WorkflowNodeType, x: number, y: number) => void;
  removeNode: (id: string) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setSelectedRunId: (id?: string) => void;
  runWorkflow: () => Promise<void>;
  runSelected: () => Promise<void>;
  runSingleNode: (id: string) => Promise<void>;
  exportWorkflow: () => { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  importWorkflow: (payload: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) => void;
  undo: () => void;
  redo: () => void;
};

const STORAGE_KEY = "nextflow-studio-v3";
const LEGACY_STORAGE_KEYS = ["nextflow-studio-v2"];

function emptyWorkflow(name: string): WorkflowRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    nodes: [],
    edges: [],
    runs: [],
    createdAt: now,
    updatedAt: now,
  };
}

function sameIds(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

function snapshot(state: WorkflowState): Snapshot {
  return {
    nodes: structuredClone(state.nodes),
    edges: structuredClone(state.edges),
  };
}

function hydrateWorkflow(workflow: WorkflowRecord) {
  const nodes = resolveWorkflowNodes(workflow.nodes, workflow.edges);

  return {
    workflowName: workflow.name,
    currentWorkflowId: workflow.id,
    nodes,
    edges: workflow.edges,
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

function sanitizeStoredWorkflows(workflows: WorkflowRecord[]) {
  return workflows.map((workflow) => ({
    ...workflow,
    runs: [],
  }));
}

function syncWorkflow(state: WorkflowState, next: { workflowName?: string; nodes?: WorkflowNode[]; edges?: WorkflowEdge[]; runs?: WorkflowRun[] }) {
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
          nodes,
          edges,
          runs,
          updatedAt,
        }
      : workflow,
  );

  persist(workflows, state.currentWorkflowId);

  return {
    workflows,
    workflowName,
    nodes,
    edges,
    runs,
  };
}

function withResolvedInputs(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  return nodes.map((node) => {
    if (node.data.nodeType === "runLLM") {
      const systemPrompt = getIncomingValue(edges, nodes, node.id, "system_prompt") ?? node.data.systemPrompt;
      const userMessage = getIncomingValue(edges, nodes, node.id, "user_message") ?? node.data.userMessage;
      const connectedImages = getIncomingValues(edges, nodes, node.id, "images");

      return {
        ...node,
        data: {
          ...node.data,
          systemPrompt,
          userMessage,
          connectedImages,
          validationError: userMessage.trim() ? undefined : "User message is required.",
        },
      };
    }

    if (node.data.nodeType === "generateImage") {
      const systemPrompt = getIncomingValue(edges, nodes, node.id, "system_prompt") ?? node.data.systemPrompt;
      const userMessage = getIncomingValue(edges, nodes, node.id, "user_message") ?? node.data.userMessage;
      const connectedImages = getIncomingValues(edges, nodes, node.id, "images");

      return {
        ...node,
        data: {
          ...node.data,
          systemPrompt,
          userMessage,
          connectedImages,
          validationError: userMessage.trim() ? undefined : "Prompt is required.",
        },
      };
    }

    if (node.data.nodeType === "cropImage") {
      return {
        ...node,
        data: {
          ...node.data,
          imageUrl: getIncomingValue(edges, nodes, node.id, "image_url") ?? node.data.imageUrl,
          xPercent: getIncomingValue(edges, nodes, node.id, "x_percent") ?? node.data.xPercent,
          yPercent: getIncomingValue(edges, nodes, node.id, "y_percent") ?? node.data.yPercent,
          widthPercent: getIncomingValue(edges, nodes, node.id, "width_percent") ?? node.data.widthPercent,
          heightPercent: getIncomingValue(edges, nodes, node.id, "height_percent") ?? node.data.heightPercent,
        },
      };
    }

    if (node.data.nodeType === "extractFrame") {
      return {
        ...node,
        data: {
          ...node.data,
          videoUrl: getIncomingValue(edges, nodes, node.id, "video_url") ?? node.data.videoUrl,
          timestamp: getIncomingValue(edges, nodes, node.id, "timestamp") ?? node.data.timestamp,
        },
      };
    }

    return node;
  });
}

function resolveWorkflowNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  return withResolvedInputs(nodes, edges);
}

function buildRequestFailureRun(
  workflowId: string,
  scope: WorkflowRunScope,
  nodes: WorkflowNode[],
  targetIds: string[] | undefined,
  error: string,
): WorkflowRun {
  const activeIds = targetIds?.length ? new Set(targetIds) : new Set(nodes.map((node) => node.id));
  const nodeRuns = nodes
    .filter((node) => activeIds.has(node.id))
    .map((node) => ({
      nodeId: node.id,
      nodeLabel: node.data.label,
      nodeType: node.data.nodeType,
      status: "failed" as const,
      executionMs: 0,
      inputs: [node.data.description],
      error,
    }));

  return {
    id: `run-${crypto.randomUUID()}`,
    workflowId,
    scope,
    status: "failed",
    startedAt: new Date().toISOString(),
    durationMs: 0,
    summary: error,
    nodeRuns,
  };
}

export const useWorkflowStudioStore = create<WorkflowState>((set, get) => {
  const initial = emptyWorkflow("Workflow 1");

  async function executeRun(scope: WorkflowRunScope, targetIds?: string[]) {
    const state = get();
    const response = await fetch("/api/workflows/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflowId: state.currentWorkflowId,
        scope,
        targetIds,
        nodes: state.nodes,
        edges: state.edges,
      }),
    });

    if (!response.ok) {
      throw new Error("Workflow execution request failed.");
    }

    return (await response.json()) as {
      ok: boolean;
      run: WorkflowRun;
      nodes: WorkflowNode[];
    };
  }

  return {
    workflowName: initial.name,
    currentWorkflowId: initial.id,
    workflows: [initial],
    nodes: [],
    edges: [],
    runs: [],
    selectedRunId: undefined,
    selectedNodeIds: [],
    undoStack: [],
    redoStack: [],

    initialize: () => {
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (saved) {
        const parsed = JSON.parse(saved) as { workflows: WorkflowRecord[]; currentWorkflowId: string };
        const workflows = parsed.workflows?.length ? parsed.workflows : [emptyWorkflow("Workflow 1")];
        const selected = workflows.find((workflow) => workflow.id === parsed.currentWorkflowId) ?? workflows[0];

        set({
          workflows,
          ...hydrateWorkflow(selected),
        });
        return;
      }

      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        const legacySaved = typeof window !== "undefined" ? window.localStorage.getItem(legacyKey) : null;
        if (!legacySaved) {
          continue;
        }

        const parsed = JSON.parse(legacySaved) as { workflows: WorkflowRecord[]; currentWorkflowId: string };
        const workflows = sanitizeStoredWorkflows(parsed.workflows?.length ? parsed.workflows : [emptyWorkflow("Workflow 1")]);
        const selected = workflows.find((workflow) => workflow.id === parsed.currentWorkflowId) ?? workflows[0];

        persist(workflows, selected.id);
        set({
          workflows,
          ...hydrateWorkflow(selected),
        });
        return;
      }

      persist([initial], initial.id);
      set({
        workflows: [initial],
        ...hydrateWorkflow(initial),
      });
    },

    createWorkflow: () =>
      set((state) => {
        const workflow = emptyWorkflow(`Workflow ${state.workflows.length + 1}`);
        const workflows = [...state.workflows, workflow];
        persist(workflows, workflow.id);
        return {
          workflows,
          ...hydrateWorkflow(workflow),
        };
      }),

    selectWorkflow: (id) =>
      set((state) => {
        if (state.currentWorkflowId === id) {
          return state;
        }

        const synced = syncWorkflow(state, {});
        const workflows = synced.workflows;
        const workflow = workflows.find((item) => item.id === id);
        if (!workflow) {
          return state;
        }

        persist(workflows, workflow.id);
        return {
          workflows,
          ...hydrateWorkflow(workflow),
        };
      }),

    deleteWorkflow: (id) =>
      set((state) => {
        const remaining = state.workflows.filter((workflow) => workflow.id !== id);
        const workflows = remaining.length ? remaining : [emptyWorkflow("Workflow 1")];
        const nextWorkflow = workflows[0];
        persist(workflows, nextWorkflow.id);
        return {
          workflows,
          ...hydrateWorkflow(nextWorkflow),
        };
      }),

    renameWorkflow: (name) =>
      set((state) => {
        const trimmed = name.trim() || "Untitled workflow";
        const synced = syncWorkflow(state, { workflowName: trimmed });
        return {
          ...synced,
        };
      }),

    loadSampleWorkflow: (templateId) =>
      set((state) => {
        const template = workflowTemplates.find((item) => item.id === templateId) ?? workflowTemplates[0];
        const nodes = resolveWorkflowNodes(structuredClone(template.nodes), structuredClone(template.edges));
        const edges = structuredClone(template.edges);
        const runs = structuredClone(template.runs);
        const synced = syncWorkflow(state, {
          nodes,
          edges,
          runs,
          workflowName: template.name,
        });
        return {
          ...synced,
          selectedRunId: runs[0]?.id,
          selectedNodeIds: [],
          undoStack: [],
          redoStack: [],
        };
      }),

    onNodesChange: (changes) =>
      set((state) => {
        const nextNodes = applyNodeChanges(changes, state.nodes) as WorkflowNode[];
        const nodes = resolveWorkflowNodes(nextNodes, state.edges);
        const synced = syncWorkflow(state, { nodes });
        return {
          ...synced,
          undoStack: [...state.undoStack, snapshot(state)],
          redoStack: [],
        };
      }),

    onEdgesChange: (changes) =>
      set((state) => {
        const edges = applyEdgeChanges(changes, state.edges);
        const nodes = resolveWorkflowNodes(state.nodes, edges);
        const synced = syncWorkflow(state, { nodes, edges });
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

        const edges = addEdge({ ...connection, animated: true }, state.edges);
        const nodes = resolveWorkflowNodes(state.nodes, edges);
        const synced = syncWorkflow(state, { nodes, edges });
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
        const nodes = resolveWorkflowNodes(nextNodes, state.edges);
        const synced = syncWorkflow(state, { nodes });
        return {
          ...synced,
          undoStack: [...state.undoStack, snapshot(state)],
          redoStack: [],
        };
      }),

    addNode: (type) =>
      set((state) => {
        const nodes = resolveWorkflowNodes([...state.nodes, createNodeTemplate(type, state.nodes.length)], state.edges);
        const synced = syncWorkflow(state, { nodes });
        return {
          ...synced,
          undoStack: [...state.undoStack, snapshot(state)],
          redoStack: [],
        };
      }),

    addNodeAtPosition: (type, x, y) =>
      set((state) => {
        const node = createNodeTemplate(type, state.nodes.length);
        node.position = { x, y };
        const nodes = resolveWorkflowNodes([...state.nodes, node], state.edges);
        const synced = syncWorkflow(state, { nodes });
        return {
          ...synced,
          undoStack: [...state.undoStack, snapshot(state)],
          redoStack: [],
        };
      }),

    removeNode: (id) =>
      set((state) => {
        const nextNodes = state.nodes.filter((node) => node.id !== id);
        const edges = state.edges.filter((edge) => edge.source !== id && edge.target !== id);
        const nodes = resolveWorkflowNodes(nextNodes, edges);
        const synced = syncWorkflow(state, { nodes, edges });
        return {
          ...synced,
          undoStack: [...state.undoStack, snapshot(state)],
          redoStack: [],
        };
      }),

    setSelectedNodeIds: (ids) =>
      set((state) => {
        if (sameIds(state.selectedNodeIds, ids)) {
          return state;
        }

        return { selectedNodeIds: ids };
      }),

    setSelectedRunId: (id) =>
      set((state) => {
        if (state.selectedRunId === id) {
          return state;
        }

        return { selectedRunId: id };
      }),

    runWorkflow: async () => {
      const state = get();
      const runningIds = new Set(state.nodes.map((node) => node.id));
      const nodes = state.nodes.map((node) => ({ ...node, data: { ...node.data, running: runningIds.has(node.id) } }));
      set(syncWorkflow(state, { nodes }));

      try {
        const result = await executeRun("full");
        const materialized = await materializeMediaOutputs(result.nodes, result.run);
        set((current) => {
          const runs = [materialized.run, ...current.runs];
          const synced = syncWorkflow(current, { nodes: materialized.nodes, runs });
          return {
            ...synced,
            selectedRunId: materialized.run.id,
          };
        });
      } catch {
        const resolved = withResolvedInputs(get().nodes, get().edges);
        const error = "Workflow execution request failed. Check your network connection or execution service configuration.";
        const run = buildRequestFailureRun(get().currentWorkflowId, "full", resolved, undefined, error);
        const finishedNodes = resolved.map((node) => ({
          ...node,
          data: {
            ...node.data,
            running: false,
            validationError: error,
          },
        }));
        set((current) => {
          const runs = [run, ...current.runs];
          const synced = syncWorkflow(current, { nodes: finishedNodes, runs });
          return {
            ...synced,
            selectedRunId: run.id,
          };
        });
      }
    },

    runSelected: async () => {
      const state = get();
      const targets = state.selectedNodeIds.length ? state.selectedNodeIds : state.nodes.slice(0, 2).map((node) => node.id);
      const runningNodes = state.nodes.map((node) => ({
        ...node,
        data: { ...node.data, running: targets.includes(node.id) },
      }));
      set(syncWorkflow(state, { nodes: runningNodes }));

      try {
        const result = await executeRun("selected", targets);
        const materialized = await materializeMediaOutputs(result.nodes, result.run);
        set((current) => {
          const runs = [materialized.run, ...current.runs];
          const synced = syncWorkflow(current, { nodes: materialized.nodes, runs });
          return {
            ...synced,
            selectedRunId: materialized.run.id,
          };
        });
      } catch {
        const resolved = withResolvedInputs(get().nodes, get().edges);
        const error = "Selected node execution request failed. Check your network connection or execution service configuration.";
        const run = buildRequestFailureRun(get().currentWorkflowId, "selected", resolved, targets, error);
        set((current) => {
          const nodes = resolved.map((node) => ({ ...node, data: { ...node.data, running: false } }));
          const runs = [run, ...current.runs];
          const finishedNodes = nodes.map((node) => ({
            ...node,
            data: {
              ...node.data,
              validationError: run.nodeRuns.find((item) => item.nodeId === node.id)?.error,
            },
          }));
          const synced = syncWorkflow(current, { nodes: finishedNodes, runs });
          return {
            ...synced,
            selectedRunId: run.id,
          };
        });
      }
    },

    runSingleNode: async (id) => {
      set((state) => {
        const nodes = state.nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, running: true } } : node,
        );
        return syncWorkflow(state, { nodes });
      });

      try {
        const result = await executeRun("single", [id]);
        const materialized = await materializeMediaOutputs(result.nodes, result.run);
        set((state) => {
          const runs = [materialized.run, ...state.runs];
          const synced = syncWorkflow(state, { nodes: materialized.nodes, runs });
          return {
            ...synced,
            selectedRunId: materialized.run.id,
          };
        });
      } catch {
        const resolved = withResolvedInputs(get().nodes, get().edges);
        const error = "Single node execution request failed. Check your network connection or execution service configuration.";
        const run = buildRequestFailureRun(get().currentWorkflowId, "single", resolved, [id], error);
        set((state) => {
          const nodes = resolved.map((node) =>
            node.id === id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    running: false,
                    validationError: run.nodeRuns[0]?.error,
                  },
                }
              : node,
          );
          const runs = [run, ...state.runs];
          const synced = syncWorkflow(state, { nodes, runs });
          return {
            ...synced,
            selectedRunId: run.id,
          };
        });
      }
    },

    exportWorkflow: () => ({ nodes: get().nodes, edges: get().edges }),

    importWorkflow: (payload) =>
      set((state) => {
        const nodes = resolveWorkflowNodes(payload.nodes, payload.edges);
        const synced = syncWorkflow(state, { nodes, edges: payload.edges, runs: [] });
        return {
          ...synced,
          selectedRunId: undefined,
          undoStack: [...state.undoStack, snapshot(state)],
          redoStack: [],
        };
      }),

    undo: () =>
      set((state) => {
        const previous = state.undoStack[state.undoStack.length - 1];
        if (!previous) {
          return state;
        }

        const synced = syncWorkflow(state, {
          nodes: previous.nodes,
          edges: previous.edges,
        });

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

        const synced = syncWorkflow(state, {
          nodes: next.nodes,
          edges: next.edges,
        });

        return {
          ...synced,
          redoStack: state.redoStack.slice(0, -1),
          undoStack: [...state.undoStack, snapshot(state)],
        };
      }),
  };
});
