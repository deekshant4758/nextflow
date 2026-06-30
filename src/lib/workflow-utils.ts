import type { Connection, Edge } from "@xyflow/react";
import type {
  DataKind,
  RequestField,
  ResponseItem,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeType,
  WorkflowRunScope,
  WorkflowRunStatus,
} from "@/types/workflow";

export function sourceKindForHandle(node: WorkflowNode, handle?: string): DataKind | undefined {
  if (node.data.nodeType === "request") {
    const field = node.data.fields.find((item) => item.id === handle);
    if (!field) {
      return undefined;
    }

    return field.type === "image_field" ? "image" : "text";
  }

  if (node.data.nodeType === "cropImage") {
    return "image";
  }

  if (node.data.nodeType === "gemini") {
    return "text";
  }

  return undefined;
}

export function getSourceValue(node: WorkflowNode, handle?: string) {
  if (node.data.nodeType === "request") {
    return node.data.fields.find((item) => item.id === handle)?.value ?? "";
  }

  if (node.data.nodeType === "cropImage") {
    return node.data.outputImage ?? "";
  }

  if (node.data.nodeType === "gemini") {
    return node.data.response ?? "";
  }

  return "";
}

export function getIncomingValue(edges: WorkflowEdge[], nodes: WorkflowNode[], nodeId: string, handle: string) {
  return getIncomingValues(edges, nodes, nodeId, handle)[0];
}

export function getIncomingValues(edges: WorkflowEdge[], nodes: WorkflowNode[], nodeId: string, handle: string) {
  return edges
    .filter((edge) => edge.target === nodeId && edge.targetHandle === handle)
    .map((edge) => {
      const sourceNode = nodes.find((node) => node.id === edge.source);
      if (!sourceNode) {
        return undefined;
      }

      return getSourceValue(sourceNode, edge.sourceHandle ?? undefined);
    })
    .filter((value): value is string => Boolean(value));
}

function getIncomingNumber(edges: WorkflowEdge[], nodes: WorkflowNode[], nodeId: string, handle: string, fallback: number) {
  const value = getIncomingValue(edges, nodes, nodeId, handle);
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getIncomingBoolean(edges: WorkflowEdge[], nodes: WorkflowNode[], nodeId: string, handle: string, fallback: boolean) {
  const value = getIncomingValue(edges, nodes, nodeId, handle);
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }

  return fallback;
}

export function buildResponseItems(edges: WorkflowEdge[], nodes: WorkflowNode[], responseNodeId: string): ResponseItem[] {
  return edges
    .filter((edge) => edge.target === responseNodeId && edge.targetHandle === "result")
    .map((edge) => {
      const sourceNode = nodes.find((node) => node.id === edge.source);
      const sourceLabel = sourceNode?.data.label ?? "Output";

      return {
        id: edge.id,
        sourceNodeId: edge.source,
        sourceNodeLabel: sourceLabel,
        sourceHandle: edge.sourceHandle ?? "output",
        value: sourceNode ? getSourceValue(sourceNode, edge.sourceHandle ?? undefined) : "",
      };
    });
}

export function isInputConnected(edges: WorkflowEdge[], nodeId: string, handle: string) {
  return edges.some((edge) => edge.target === nodeId && edge.targetHandle === handle);
}

function acceptsHandle(target: WorkflowNode, handle: string, kind?: DataKind) {
  if (target.data.nodeType === "gemini") {
    if (handle === "image_vision") {
      return kind === "image";
    }

    if (handle === "prompt" || handle === "system_prompt") {
      return kind === "text";
    }

    if (
      [
        "temperature",
        "max_tokens",
        "reasoning",
        "top_p",
        "top_k",
        "frequency_penalty",
        "presence_penalty",
        "repetition_penalty",
        "min_p",
        "top_a",
        "seed",
        "stop",
        "response_format",
        "settings",
      ].includes(handle)
    ) {
      return kind === "text";
    }

    return false;
  }

  if (target.data.nodeType === "cropImage") {
    if (handle === "input_image") {
      return kind === "image";
    }

    return kind === "text";
  }

  if (target.data.nodeType === "response") {
    return kind === "text" || kind === "image";
  }

  return false;
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

  if (targetNode.data.nodeType === "request") {
    return false;
  }

  const kind = sourceKindForHandle(sourceNode, connection.sourceHandle ?? undefined);
  if (!acceptsHandle(targetNode, connection.targetHandle ?? "", kind)) {
    return false;
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
    stack.push(...(adjacency.get(current) ?? []));
  }

  return false;
}

function createField(field: Partial<RequestField> & Pick<RequestField, "type">): RequestField {
  return {
    id: field.id ?? `field_${crypto.randomUUID()}`,
    label:
      field.label ??
      (field.type === "image_field"
        ? "image_field"
        : field.type === "boolean_field"
          ? "boolean_field"
          : field.type === "number_field"
            ? "number_field"
          : "text_field"),
    type: field.type,
    value: field.value ?? "",
  };
}

function requestNode(position: { x: number; y: number }, fields?: RequestField[]) {
  return {
    id: `request-${crypto.randomUUID()}`,
    type: "request" as WorkflowNodeType,
    position,
    deletable: false,
    data: {
      label: "Request-Inputs",
      nodeType: "request" as const,
      fields:
        fields ?? [
          createField({ type: "text_field", label: "text_field", value: "" }),
          createField({ type: "image_field", label: "image_field", value: "" }),
        ],
    },
  };
}

function responseNode(position: { x: number; y: number }) {
  return {
    id: `response-${crypto.randomUUID()}`,
    type: "response" as WorkflowNodeType,
    position,
    deletable: false,
    data: {
      label: "Response",
      nodeType: "response" as const,
      items: [],
    },
  };
}

export function createNodeTemplate(type: WorkflowNodeType, index: number): WorkflowNode {
  const position = { x: 360 + index * 180, y: 180 + index * 24 };

  if (type === "request") {
    return requestNode(position);
  }

  if (type === "response") {
    return responseNode(position);
  }

  if (type === "cropImage") {
    return {
      id: `crop-${crypto.randomUUID()}`,
      type,
      position,
      data: {
        label: "Crop Image",
        nodeType: "cropImage",
        imageUrl: "",
        xPercent: "0",
        yPercent: "0",
        widthPercent: "100",
        heightPercent: "100",
      },
    };
  }

  return {
    id: `gemini-${crypto.randomUUID()}`,
    type,
    position,
    data: {
      label: "Gemini 2.5 Flash",
      nodeType: "gemini",
      model: "gemini-2.5-flash",
      prompt: "",
      systemPrompt: "",
      imageInput: "",
      response: "",
      settingsOpen: false,
      temperature: 0.7,
      maxTokens: 1024,
      reasoning: false,
      topP: 1,
      topK: 0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      repetitionPenalty: 1,
      minP: 0,
      topA: 0,
      seed: 0,
      stopSequences: "",
      jsonMode: false,
    },
  };
}

export function createBlankWorkflowNodes() {
  return [
    requestNode({ x: 80, y: 240 }),
    responseNode({ x: 1540, y: 220 }),
  ] satisfies WorkflowNode[];
}

export function edgeColorForKind(kind?: DataKind) {
  if (kind === "image") {
    return "#4f7cff";
  }

  if (kind === "text") {
    return "#f59e0b";
  }

  return "#22c55e";
}

function edgeColorForTarget(targetNode: WorkflowNode | undefined, targetHandle?: string, sourceKind?: DataKind) {
  if (!targetNode) {
    return edgeColorForKind(sourceKind);
  }

  if (targetNode.data.nodeType === "gemini") {
    if (targetHandle === "image_vision" || targetHandle === "reasoning" || targetHandle === "response_format") {
      return "#4f7cff";
    }

    if (targetHandle === "stop" || targetHandle === "prompt" || targetHandle === "system_prompt") {
      return "#f59e0b";
    }

    return "#ec4899";
  }

  if (targetNode.data.nodeType === "cropImage") {
    return targetHandle === "input_image" ? "#4f7cff" : "#ec4899";
  }

  if (targetNode.data.nodeType === "response") {
    return "#22c55e";
  }

  return edgeColorForKind(sourceKind);
}

export function styleEdge(edge: WorkflowEdge, nodes: WorkflowNode[]): WorkflowEdge {
  const sourceNode = nodes.find((node) => node.id === edge.source);
  const targetNode = nodes.find((node) => node.id === edge.target);
  const stroke = edgeColorForTarget(
    targetNode,
    edge.targetHandle ?? undefined,
    sourceNode ? sourceKindForHandle(sourceNode, edge.sourceHandle ?? undefined) : undefined,
  );

  return {
    ...edge,
    animated: false,
    style: {
      stroke,
      strokeWidth: 2,
      opacity: 0.9,
    },
  };
}

export function resolveWorkflowNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  return nodes.map((node) => {
    if (node.data.nodeType === "gemini") {
      return {
        ...node,
        data: {
          ...node.data,
          prompt: getIncomingValue(edges, nodes, node.id, "prompt") ?? node.data.prompt,
          systemPrompt: getIncomingValue(edges, nodes, node.id, "system_prompt") ?? node.data.systemPrompt,
          imageInput: getIncomingValue(edges, nodes, node.id, "image_vision") ?? node.data.imageInput,
          temperature: getIncomingNumber(edges, nodes, node.id, "temperature", node.data.temperature ?? 0.7),
          maxTokens: getIncomingNumber(edges, nodes, node.id, "max_tokens", node.data.maxTokens ?? 1024),
          reasoning: getIncomingBoolean(edges, nodes, node.id, "reasoning", node.data.reasoning ?? false),
          topP: getIncomingNumber(edges, nodes, node.id, "top_p", node.data.topP ?? 1),
          topK: getIncomingNumber(edges, nodes, node.id, "top_k", node.data.topK ?? 0),
          frequencyPenalty: getIncomingNumber(edges, nodes, node.id, "frequency_penalty", node.data.frequencyPenalty ?? 0),
          presencePenalty: getIncomingNumber(edges, nodes, node.id, "presence_penalty", node.data.presencePenalty ?? 0),
          repetitionPenalty: getIncomingNumber(edges, nodes, node.id, "repetition_penalty", node.data.repetitionPenalty ?? 1),
          minP: getIncomingNumber(edges, nodes, node.id, "min_p", node.data.minP ?? 0),
          topA: getIncomingNumber(edges, nodes, node.id, "top_a", node.data.topA ?? 0),
          seed: getIncomingNumber(edges, nodes, node.id, "seed", node.data.seed ?? 0),
          stopSequences: getIncomingValue(edges, nodes, node.id, "stop") ?? node.data.stopSequences,
          jsonMode: getIncomingBoolean(edges, nodes, node.id, "response_format", node.data.jsonMode ?? false),
        },
      };
    }

    if (node.data.nodeType === "cropImage") {
      return {
        ...node,
        data: {
          ...node.data,
          imageUrl: getIncomingValue(edges, nodes, node.id, "input_image") ?? node.data.imageUrl,
          xPercent: getIncomingValue(edges, nodes, node.id, "x_percent") ?? node.data.xPercent,
          yPercent: getIncomingValue(edges, nodes, node.id, "y_percent") ?? node.data.yPercent,
          widthPercent: getIncomingValue(edges, nodes, node.id, "width_percent") ?? node.data.widthPercent,
          heightPercent: getIncomingValue(edges, nodes, node.id, "height_percent") ?? node.data.heightPercent,
        },
      };
    }

    if (node.data.nodeType === "response") {
      return {
        ...node,
        data: {
          ...node.data,
          items: buildResponseItems(edges, nodes, node.id),
        },
      };
    }

    return node;
  });
}

export function statusToTone(status: WorkflowRunStatus) {
  switch (status) {
    case "success":
      return "bg-emerald-100 text-emerald-700";
    case "failed":
      return "bg-red-100 text-red-700";
    case "running":
      return "bg-amber-100 text-amber-700";
    case "partial":
      return "bg-yellow-100 text-yellow-700";
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
