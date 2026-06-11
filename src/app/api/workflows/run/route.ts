import { NextResponse } from "next/server";
import { configure, runs, tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { env, featureFlags } from "@/lib/env";
import type { NodeRun, WorkflowEdge, WorkflowNode, WorkflowRun, WorkflowRunScope, WorkflowRunStatus } from "@/types/workflow";

const runSchema = z.object({
  workflowId: z.string().optional(),
  scope: z.enum(["full", "selected", "single"]),
  targetIds: z.array(z.string()).optional(),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
});

if (env.triggerSecretKey) {
  configure({
    accessToken: env.triggerSecretKey,
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Trigger.dev execution failed.";
}

function getTaskOutputValue(output: unknown) {
  if (typeof output === "object" && output && "output" in output) {
    const value = output.output;
    return typeof value === "string" ? value : "";
  }

  return typeof output === "string" ? output : "";
}

function getTaskNoteValue(output: unknown) {
  if (typeof output === "object" && output && "note" in output) {
    const value = output.note;
    return typeof value === "string" ? value : "";
  }

  return "";
}

async function triggerTaskAndWait(taskId: string, payload: Record<string, unknown>, tags: string[]) {
  const handle = await tasks.trigger(taskId, payload, { tags });
  const run = await runs.poll(handle.id, { pollIntervalMs: 1000 });

  if (run.status !== "COMPLETED") {
    return {
      ok: false as const,
      error: run.error?.message ?? `Task ended with status ${run.status}.`,
    };
  }

  return {
    ok: true as const,
    output: run.output,
  };
}

function buildExecutionUnavailableResult(
  node: WorkflowNode,
  started: number,
  inputs: string[],
  error: string,
  patch: Record<string, unknown> = {},
) {
  return {
    updatedNode: {
      ...node,
      data: {
        ...node.data,
        ...patch,
        result: error,
        validationError: error,
      },
    },
    nodeRun: {
      nodeId: node.id,
      nodeLabel: node.data.label,
      nodeType: node.data.nodeType,
      status: "failed" as WorkflowRunStatus,
      executionMs: Date.now() - started,
      inputs,
      error,
    },
  };
}

function getFallbackSourceValue(node: WorkflowNode) {
  switch (node.data.nodeType) {
    case "text":
      return node.data.text;
    case "uploadImage":
      return node.data.imageUrl ?? "";
    case "uploadVideo":
      return node.data.videoUrl ?? "";
    case "runLLM":
      return node.data.result ?? "";
    case "generateImage":
      return node.data.result ?? "";
    case "cropImage":
      return node.data.result ?? node.data.imageUrl;
    case "extractFrame":
      return node.data.result ?? node.data.videoUrl;
    default:
      return "";
  }
}

function getIncomingValues(edges: WorkflowEdge[], nodes: WorkflowNode[], outputs: Map<string, string>, nodeId: string, handle: string) {
  return edges
    .filter((edge) => edge.target === nodeId && edge.targetHandle === handle)
    .map((edge) => {
      const sourceNode = nodes.find((node) => node.id === edge.source);
      if (!sourceNode) {
        return undefined;
      }

      return outputs.get(sourceNode.id) ?? getFallbackSourceValue(sourceNode);
    })
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function sortNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
      continue;
    }

    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    const next = adjacency.get(edge.source) ?? [];
    next.push(edge.target);
    adjacency.set(edge.source, next);
  }

  const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const ordered: WorkflowNode[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) {
      continue;
    }

    const currentNode = nodeMap.get(currentId);
    if (currentNode) {
      ordered.push(currentNode);
    }

    for (const targetId of adjacency.get(currentId) ?? []) {
      indegree.set(targetId, (indegree.get(targetId) ?? 1) - 1);
      if ((indegree.get(targetId) ?? 0) === 0) {
        queue.push(targetId);
      }
    }
  }

  return ordered.length === nodes.length ? ordered : nodes;
}

async function executeNode(node: WorkflowNode, nodes: WorkflowNode[], edges: WorkflowEdge[], outputs: Map<string, string>, workflowId: string) {
  const started = Date.now();

  if (node.data.nodeType === "text") {
    const output = node.data.text;
    outputs.set(node.id, output);
    return {
      updatedNode: node,
      nodeRun: {
        nodeId: node.id,
        nodeLabel: node.data.label,
        nodeType: node.data.nodeType,
        status: "success" as WorkflowRunStatus,
        executionMs: Date.now() - started,
        inputs: ["Static text"],
        output,
      },
    };
  }

  if (node.data.nodeType === "uploadImage") {
    const output = node.data.imageUrl ?? "";
    outputs.set(node.id, output);
    return {
      updatedNode: node,
      nodeRun: {
        nodeId: node.id,
        nodeLabel: node.data.label,
        nodeType: node.data.nodeType,
        status: output ? ("success" as WorkflowRunStatus) : ("failed" as WorkflowRunStatus),
        executionMs: Date.now() - started,
        inputs: [node.data.description],
        output: output || undefined,
        error: output ? undefined : "Image URL is required.",
      },
    };
  }

  if (node.data.nodeType === "uploadVideo") {
    const output = node.data.videoUrl ?? "";
    outputs.set(node.id, output);
    return {
      updatedNode: node,
      nodeRun: {
        nodeId: node.id,
        nodeLabel: node.data.label,
        nodeType: node.data.nodeType,
        status: output ? ("success" as WorkflowRunStatus) : ("failed" as WorkflowRunStatus),
        executionMs: Date.now() - started,
        inputs: [node.data.description],
        output: output || undefined,
        error: output ? undefined : "Video URL is required.",
      },
    };
  }

  if (node.data.nodeType === "runLLM") {
    const systemPrompt = getIncomingValues(edges, nodes, outputs, node.id, "system_prompt")[0] ?? node.data.systemPrompt;
    const userMessage = getIncomingValues(edges, nodes, outputs, node.id, "user_message")[0] ?? node.data.userMessage;
    const connectedImages = getIncomingValues(edges, nodes, outputs, node.id, "images").slice(0, node.data.acceptedImageCount);

    if (!userMessage.trim()) {
      return {
        updatedNode: {
          ...node,
          data: {
            ...node.data,
            systemPrompt,
            userMessage,
            connectedImages,
            result: "User message is required.",
            validationError: "User message is required.",
          },
        },
        nodeRun: {
          nodeId: node.id,
          nodeLabel: node.data.label,
          nodeType: node.data.nodeType,
          status: "failed" as WorkflowRunStatus,
          executionMs: Date.now() - started,
          inputs: [
            systemPrompt.trim() ? "System prompt connected" : "No system prompt",
            "User message missing",
            connectedImages.length ? `${connectedImages.length} image input${connectedImages.length > 1 ? "s" : ""}` : "No image inputs",
          ],
          error: "User message is required.",
        },
      };
    }

    let output = "";

    if (featureFlags.trigger) {
      const result = await triggerTaskAndWait("run-llm-node", {
        model: node.data.model,
        systemPrompt,
        userMessage,
        images: connectedImages,
      }, {
        tags: [`workflow:${workflowId}`, `node:${node.id}`, "nextflow", "llm"],
      }.tags);

      if (!result.ok) {
        return {
          updatedNode: {
            ...node,
            data: {
              ...node.data,
              systemPrompt,
              userMessage,
              connectedImages,
              result: getErrorMessage(result.error),
              validationError: getErrorMessage(result.error),
            },
          },
          nodeRun: {
            nodeId: node.id,
            nodeLabel: node.data.label,
            nodeType: node.data.nodeType,
            status: "failed" as WorkflowRunStatus,
            executionMs: Date.now() - started,
            inputs: [
              systemPrompt.trim() ? "System prompt connected" : "No system prompt",
              "User message ready",
              connectedImages.length ? `${connectedImages.length} image input${connectedImages.length > 1 ? "s" : ""}` : "No image inputs",
            ],
            error: getErrorMessage(result.error),
          },
        };
      }

      output = getTaskOutputValue(result.output) || output;
    } else {
      return buildExecutionUnavailableResult(
        node,
        started,
        [
          systemPrompt.trim() ? "System prompt connected" : "No system prompt",
          "User message ready",
          connectedImages.length ? `${connectedImages.length} image input${connectedImages.length > 1 ? "s" : ""}` : "No image inputs",
        ],
        "Execution service is not configured. Add TRIGGER_SECRET_KEY to run this node.",
        {
          systemPrompt,
          userMessage,
          connectedImages,
        },
      );
    }

    outputs.set(node.id, output);

    return {
      updatedNode: {
        ...node,
        data: {
          ...node.data,
          systemPrompt,
          userMessage,
          connectedImages,
          result: output,
          validationError: undefined,
        },
      },
      nodeRun: {
        nodeId: node.id,
        nodeLabel: node.data.label,
        nodeType: node.data.nodeType,
        status: "success" as WorkflowRunStatus,
        executionMs: Date.now() - started,
        inputs: [
          systemPrompt.trim() ? "System prompt connected" : "No system prompt",
          "User message ready",
          connectedImages.length ? `${connectedImages.length} image input${connectedImages.length > 1 ? "s" : ""}` : "No image inputs",
        ],
        output,
      },
    };
  }

  if (node.data.nodeType === "generateImage") {
    const systemPrompt = getIncomingValues(edges, nodes, outputs, node.id, "system_prompt")[0] ?? node.data.systemPrompt;
    const userMessage = getIncomingValues(edges, nodes, outputs, node.id, "user_message")[0] ?? node.data.userMessage;
    const connectedImages = getIncomingValues(edges, nodes, outputs, node.id, "images");

    if (!userMessage.trim()) {
      return {
        updatedNode: {
          ...node,
          data: {
            ...node.data,
            systemPrompt,
            userMessage,
            connectedImages,
            result: "",
            validationError: "Prompt is required.",
          },
        },
        nodeRun: {
          nodeId: node.id,
          nodeLabel: node.data.label,
          nodeType: node.data.nodeType,
          status: "failed" as WorkflowRunStatus,
          executionMs: Date.now() - started,
          inputs: [
            systemPrompt.trim() ? "Style guidance connected" : "No style guidance",
            "Prompt missing",
            connectedImages.length ? `${connectedImages.length} reference image${connectedImages.length > 1 ? "s" : ""}` : "No reference images",
          ],
          error: "Prompt is required.",
        },
      };
    }

    let output = "";

    if (featureFlags.trigger) {
      const result = await triggerTaskAndWait(
        "generate-image-node",
        {
          model: node.data.model,
          systemPrompt,
          userMessage,
          images: connectedImages,
        },
        [`workflow:${workflowId}`, `node:${node.id}`, "nextflow", "generate-image"],
      );

      if (!result.ok) {
        return {
          updatedNode: {
            ...node,
            data: {
              ...node.data,
              systemPrompt,
              userMessage,
              connectedImages,
              result: "",
              validationError: getErrorMessage(result.error),
            },
          },
          nodeRun: {
            nodeId: node.id,
            nodeLabel: node.data.label,
            nodeType: node.data.nodeType,
            status: "failed" as WorkflowRunStatus,
            executionMs: Date.now() - started,
            inputs: [
              systemPrompt.trim() ? "Style guidance connected" : "No style guidance",
              "Prompt ready",
              connectedImages.length ? `${connectedImages.length} reference image${connectedImages.length > 1 ? "s" : ""}` : "No reference images",
            ],
            error: getErrorMessage(result.error),
          },
        };
      }

      output = getTaskOutputValue(result.output);
      const note = getTaskNoteValue(result.output);

      if (!output) {
        const message = note || "No image was generated.";
        return {
          updatedNode: {
            ...node,
            data: {
              ...node.data,
              systemPrompt,
              userMessage,
              connectedImages,
              result: "",
              validationError: message,
            },
          },
          nodeRun: {
            nodeId: node.id,
            nodeLabel: node.data.label,
            nodeType: node.data.nodeType,
            status: "failed" as WorkflowRunStatus,
            executionMs: Date.now() - started,
            inputs: [
              systemPrompt.trim() ? "Style guidance connected" : "No style guidance",
              "Prompt ready",
              connectedImages.length ? `${connectedImages.length} reference image${connectedImages.length > 1 ? "s" : ""}` : "No reference images",
            ],
            error: message,
          },
        };
      }
    } else {
      return buildExecutionUnavailableResult(
        node,
        started,
        [
          systemPrompt.trim() ? "Style guidance connected" : "No style guidance",
          "Prompt ready",
          connectedImages.length ? `${connectedImages.length} reference image${connectedImages.length > 1 ? "s" : ""}` : "No reference images",
        ],
        "Execution service is not configured. Add TRIGGER_SECRET_KEY to run this node.",
        {
          systemPrompt,
          userMessage,
          connectedImages,
        },
      );
    }

    outputs.set(node.id, output);

    return {
      updatedNode: {
        ...node,
        data: {
          ...node.data,
          systemPrompt,
          userMessage,
          connectedImages,
          result: output,
          validationError: undefined,
        },
      },
      nodeRun: {
        nodeId: node.id,
        nodeLabel: node.data.label,
        nodeType: node.data.nodeType,
        status: "success" as WorkflowRunStatus,
        executionMs: Date.now() - started,
        inputs: [
          systemPrompt.trim() ? "Style guidance connected" : "No style guidance",
          "Prompt ready",
          connectedImages.length ? `${connectedImages.length} reference image${connectedImages.length > 1 ? "s" : ""}` : "No reference images",
        ],
        output,
      },
    };
  }

  if (node.data.nodeType === "cropImage") {
    const imageUrl = getIncomingValues(edges, nodes, outputs, node.id, "image_url")[0] ?? node.data.imageUrl;

    if (!imageUrl.trim()) {
      return {
        updatedNode: {
          ...node,
          data: {
            ...node.data,
            imageUrl,
            result: "Image input is required.",
          },
        },
        nodeRun: {
          nodeId: node.id,
          nodeLabel: node.data.label,
          nodeType: node.data.nodeType,
          status: "failed" as WorkflowRunStatus,
          executionMs: Date.now() - started,
          inputs: ["Image input missing", `x=${node.data.xPercent} y=${node.data.yPercent} w=${node.data.widthPercent} h=${node.data.heightPercent}`],
          error: "Image input is required.",
        },
      };
    }

    let output = imageUrl;

    if (featureFlags.trigger) {
      const result = await triggerTaskAndWait("crop-image-node", {
        imageUrl,
        xPercent: getIncomingValues(edges, nodes, outputs, node.id, "x_percent")[0] ?? node.data.xPercent,
        yPercent: getIncomingValues(edges, nodes, outputs, node.id, "y_percent")[0] ?? node.data.yPercent,
        widthPercent: getIncomingValues(edges, nodes, outputs, node.id, "width_percent")[0] ?? node.data.widthPercent,
        heightPercent: getIncomingValues(edges, nodes, outputs, node.id, "height_percent")[0] ?? node.data.heightPercent,
      }, {
        tags: [`workflow:${workflowId}`, `node:${node.id}`, "nextflow", "crop"],
      }.tags);

      if (!result.ok) {
        return {
          updatedNode: {
            ...node,
            data: {
              ...node.data,
              imageUrl,
              result: getErrorMessage(result.error),
            },
          },
          nodeRun: {
            nodeId: node.id,
            nodeLabel: node.data.label,
            nodeType: node.data.nodeType,
            status: "failed" as WorkflowRunStatus,
            executionMs: Date.now() - started,
            inputs: ["Image input connected", `x=${node.data.xPercent} y=${node.data.yPercent} w=${node.data.widthPercent} h=${node.data.heightPercent}`],
            error: getErrorMessage(result.error),
          },
        };
      }

      output = getTaskOutputValue(result.output) || output;
    } else {
      return buildExecutionUnavailableResult(
        node,
        started,
        ["Image input connected", `x=${node.data.xPercent} y=${node.data.yPercent} w=${node.data.widthPercent} h=${node.data.heightPercent}`],
        "Execution service is not configured. Add TRIGGER_SECRET_KEY to run this node.",
        {
          imageUrl,
        },
      );
    }

    outputs.set(node.id, output);

    return {
      updatedNode: {
        ...node,
        data: {
          ...node.data,
          imageUrl,
          result: output,
        },
      },
      nodeRun: {
        nodeId: node.id,
        nodeLabel: node.data.label,
        nodeType: node.data.nodeType,
        status: "success" as WorkflowRunStatus,
        executionMs: Date.now() - started,
        inputs: ["Image input connected", `x=${node.data.xPercent} y=${node.data.yPercent} w=${node.data.widthPercent} h=${node.data.heightPercent}`],
        output,
      },
    };
  }

  const videoUrl = getIncomingValues(edges, nodes, outputs, node.id, "video_url")[0] ?? node.data.videoUrl;

  if (!videoUrl.trim()) {
    return {
      updatedNode: {
        ...node,
        data: {
          ...node.data,
          videoUrl,
          result: "Video input is required.",
        },
      },
      nodeRun: {
        nodeId: node.id,
        nodeLabel: node.data.label,
        nodeType: node.data.nodeType,
        status: "failed" as WorkflowRunStatus,
        executionMs: Date.now() - started,
        inputs: ["Video input missing", `timestamp=${node.data.timestamp || "0"}`],
        error: "Video input is required.",
      },
    };
  }

  let output = "Frame extracted from connected video input.";

  if (featureFlags.trigger) {
    const result = await triggerTaskAndWait("extract-frame-node", {
      videoUrl,
      timestamp: getIncomingValues(edges, nodes, outputs, node.id, "timestamp")[0] ?? node.data.timestamp,
    }, {
      tags: [`workflow:${workflowId}`, `node:${node.id}`, "nextflow", "frame"],
    }.tags);

    if (!result.ok) {
      return {
        updatedNode: {
          ...node,
          data: {
            ...node.data,
            videoUrl,
            result: getErrorMessage(result.error),
          },
        },
        nodeRun: {
          nodeId: node.id,
          nodeLabel: node.data.label,
          nodeType: node.data.nodeType,
          status: "failed" as WorkflowRunStatus,
          executionMs: Date.now() - started,
          inputs: ["Video input connected", `timestamp=${node.data.timestamp || "0"}`],
          error: getErrorMessage(result.error),
        },
      };
    }

    output = getTaskOutputValue(result.output) || output;
  } else {
    return buildExecutionUnavailableResult(
      node,
      started,
      ["Video input connected", `timestamp=${node.data.timestamp || "0"}`],
      "Execution service is not configured. Add TRIGGER_SECRET_KEY to run this node.",
      {
        videoUrl,
      },
    );
  }

  outputs.set(node.id, output);

  return {
    updatedNode: {
      ...node,
      data: {
        ...node.data,
        videoUrl,
        result: output,
      },
    },
    nodeRun: {
      nodeId: node.id,
      nodeLabel: node.data.label,
      nodeType: node.data.nodeType,
      status: "success" as WorkflowRunStatus,
      executionMs: Date.now() - started,
      inputs: ["Video input connected", `timestamp=${node.data.timestamp || "0"}`],
      output,
    },
  };
}

export async function POST(request: Request) {
  const body = await request.json();
  const payload = runSchema.parse(body);
  const nodes = payload.nodes as WorkflowNode[];
  const edges = payload.edges as WorkflowEdge[];
  const activeIds = payload.targetIds?.length ? new Set(payload.targetIds) : new Set(nodes.map((node) => node.id));
  const ordered = sortNodes(nodes, edges);
  const outputs = new Map<string, string>();
  const nodeRuns: NodeRun[] = [];
  const updatedNodes = new Map<string, WorkflowNode>();
  const startedAt = new Date();
  const workflowId = payload.workflowId ?? "local-workflow";

  for (const node of ordered) {
    if (!activeIds.has(node.id)) {
      updatedNodes.set(node.id, node);
      continue;
    }

    const executed = await executeNode(node, nodes, edges, outputs, workflowId);
    nodeRuns.push(executed.nodeRun);
    updatedNodes.set(node.id, {
      ...executed.updatedNode,
      data: {
        ...executed.updatedNode.data,
        running: false,
      },
    });
  }

  for (const node of nodes) {
    if (!updatedNodes.has(node.id)) {
      updatedNodes.set(node.id, node);
    }
  }

  const status = nodeRuns.some((run) => run.status === "failed") ? "failed" : ("success" as WorkflowRunStatus);
  const run: WorkflowRun = {
    id: `run-${crypto.randomUUID()}`,
    workflowId,
    scope: payload.scope as WorkflowRunScope,
    status,
    startedAt: startedAt.toISOString(),
    durationMs: nodeRuns.reduce((sum, runItem) => sum + runItem.executionMs, 0),
    summary:
      status === "failed"
        ? "One or more nodes need required inputs or returned an execution error."
        : featureFlags.trigger
          ? "Workflow executed through Trigger.dev."
          : "Workflow execution completed.",
    nodeRuns,
  };

  return NextResponse.json({
    ok: true,
    run,
    nodes: nodes.map((node) => updatedNodes.get(node.id) ?? node),
  });
}
