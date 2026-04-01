import type { Connection, Edge, Node } from "@xyflow/react";
import type {
  ConnectionHandle,
  DataKind,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeType,
  WorkflowRunScope,
  WorkflowRunStatus,
} from "@/types/workflow";

const inputKinds: Record<WorkflowNodeType, Partial<Record<ConnectionHandle, DataKind>>> = {
  text: {},
  uploadImage: {},
  uploadVideo: {},
  runLLM: {
    system_prompt: "text",
    user_message: "text",
  },
  generateImage: {
    system_prompt: "text",
    user_message: "text",
  },
  cropImage: {
    image_url: "image",
    x_percent: "text",
    y_percent: "text",
    width_percent: "text",
    height_percent: "text",
  },
  extractFrame: {
    video_url: "video",
    timestamp: "text",
  },
};

function getOutputKind(node?: Node<WorkflowNodeData>) {
  return node?.data.outputKind;
}

export function getIncomingValue(edges: WorkflowEdge[], nodes: WorkflowNode[], nodeId: string, handle: string) {
  return getIncomingValues(edges, nodes, nodeId, handle)[0];
}

export function getIncomingValues(edges: WorkflowEdge[], nodes: WorkflowNode[], nodeId: string, handle: string) {
  return edges
    .filter((item) => item.target === nodeId && item.targetHandle === handle)
    .map((edge) => {
      const source = nodes.find((item) => item.id === edge.source);
      if (!source) {
        return undefined;
      }

      switch (source.data.nodeType) {
        case "text":
          return source.data.text;
        case "uploadImage":
          return source.data.imageUrl;
        case "uploadVideo":
          return source.data.videoUrl;
        case "runLLM":
          return source.data.result;
        case "generateImage":
          return source.data.result;
        case "cropImage":
          return source.data.result ?? source.data.imageUrl;
        case "extractFrame":
          return source.data.result ?? source.data.videoUrl;
        default:
          return undefined;
      }
    })
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

export function isInputConnected(edges: WorkflowEdge[], nodeId: string, handle: string) {
  return edges.some((edge) => edge.target === nodeId && edge.targetHandle === handle);
}

export function canConnect(connection: Edge | Connection, nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  if (!connection.source || !connection.target || connection.source === connection.target) {
    return false;
  }

  const sourceNode = nodes.find((node) => node.id === connection.source);
  const targetNode = nodes.find((node) => node.id === connection.target);
  if (!sourceNode || !targetNode) {
    return false;
  }

  const kind = getOutputKind(sourceNode);
  const targetHandle = (connection.targetHandle ?? "output") as ConnectionHandle;

  if (targetHandle === "images") {
    if (kind !== "image") {
      return false;
    }
  } else {
    const allowed = inputKinds[targetNode.data.nodeType][targetHandle];
    if (!allowed || allowed !== kind) {
      return false;
    }
  }

  return !createsCycle(connection.source, connection.target, edges);
}

function createsCycle(sourceId: string, targetId: string, edges: WorkflowEdge[]) {
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }

  const stack = [targetId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) {
      continue;
    }

    if (current === sourceId) {
      return true;
    }

    visited.add(current);
    const next = adjacency.get(current) ?? [];
    stack.push(...next);
  }

  return false;
}

export function createNodeTemplate(type: WorkflowNodeType, index: number): WorkflowNode {
  const position = { x: 180 + (index % 3) * 280, y: 180 + index * 48 };
  const common = {
    position,
    data: {
      label: "",
      nodeType: type,
      description: "",
    },
  };

  switch (type) {
    case "text":
      return {
        id: `text-${crypto.randomUUID()}`,
        type,
        ...common,
        data: {
          ...common.data,
          label: "Text",
          nodeType: "text",
          description: "Prompt or structured text",
          text: "Describe the intent for this node...",
          role: "message",
          outputKind: "text",
        },
      };
    case "uploadImage":
      return {
        id: `upload-image-${crypto.randomUUID()}`,
        type,
        ...common,
        data: {
          ...common.data,
          label: "Upload Image",
          nodeType: "uploadImage",
          description: "Transloadit powered media input",
          fileName: "hero-shot.webp",
          imageUrl:
            "https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=1200&q=80",
          outputKind: "image",
        },
      };
    case "uploadVideo":
      return {
        id: `upload-video-${crypto.randomUUID()}`,
        type,
        ...common,
        data: {
          ...common.data,
          label: "Upload Video",
          nodeType: "uploadVideo",
          description: "Transloadit video input",
          fileName: "campaign-cut.mp4",
          videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
          outputKind: "video",
        },
      };
    case "runLLM":
      return {
        id: `llm-${crypto.randomUUID()}`,
        type,
        ...common,
        data: {
          ...common.data,
          label: "Run Any LLM",
          nodeType: "runLLM",
          description: "Gemini via Trigger.dev",
          model: "gemini-2.5-flash-lite",
          systemPrompt: "",
          userMessage: "",
          acceptedImageCount: 4,
          connectedImages: [],
          outputKind: "text",
        },
      };
    case "generateImage":
      return {
        id: `generate-image-${crypto.randomUUID()}`,
        type,
        ...common,
        data: {
          ...common.data,
          label: "Generate Image",
          nodeType: "generateImage",
          description: "Gemini image generation",
          model: "gemini-3.1-flash-image-preview",
          systemPrompt: "",
          userMessage: "",
          connectedImages: [],
          outputKind: "image",
        },
      };
    case "cropImage":
      return {
        id: `crop-${crypto.randomUUID()}`,
        type,
        ...common,
        data: {
          ...common.data,
          label: "Crop Image",
          nodeType: "cropImage",
          description: "FFmpeg crop task",
          imageUrl: "",
          xPercent: "0",
          yPercent: "0",
          widthPercent: "100",
          heightPercent: "100",
          outputKind: "image",
        },
      };
    case "extractFrame":
      return {
        id: `frame-${crypto.randomUUID()}`,
        type,
        ...common,
        data: {
          ...common.data,
          label: "Extract Frame",
          nodeType: "extractFrame",
          description: "FFmpeg still frame task",
          videoUrl: "",
          timestamp: "0",
          outputKind: "image",
        },
      };
  }
}

export function statusToTone(status: WorkflowRunStatus) {
  switch (status) {
    case "success":
      return "bg-emerald-500/16 text-emerald-200";
    case "failed":
      return "bg-red-500/16 text-red-200";
    case "running":
      return "bg-amber-500/16 text-amber-200";
    case "partial":
      return "bg-yellow-500/16 text-yellow-100";
  }
}

export function scopeToLabel(scope: WorkflowRunScope) {
  switch (scope) {
    case "full":
      return "Full Workflow";
    case "selected":
      return "Selected Nodes";
    case "single":
      return "Single Node";
  }
}
