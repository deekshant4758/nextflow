import type { Edge, Node } from "@xyflow/react";

export type WorkflowNodeType = "request" | "gemini" | "cropImage" | "response";

export type DataKind = "text" | "image";

export type RequestFieldType = "text_field" | "image_field" | "boolean_field" | "number_field";

export type WorkflowRunStatus = "success" | "failed" | "running" | "partial";
export type WorkflowRunScope = "full" | "selected" | "single";

export type RequestField = {
  id: string;
  label: string;
  type: RequestFieldType;
  value: string;
};

export type ResponseItem = {
  id: string;
  sourceNodeId: string;
  sourceNodeLabel: string;
  sourceHandle: string;
  value?: string;
};

export type BaseNodeData = {
  label: string;
  nodeType: WorkflowNodeType;
  running?: boolean;
};

export type RequestNodeData = BaseNodeData & {
  nodeType: "request";
  fields: RequestField[];
};

export type GeminiNodeData = BaseNodeData & {
  nodeType: "gemini";
  model: string;
  prompt: string;
  systemPrompt: string;
  imageInput?: string;
  response?: string;
  settingsOpen?: boolean;
  temperature?: number;
  maxTokens?: number;
  reasoning?: boolean;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  repetitionPenalty?: number;
  minP?: number;
  topA?: number;
  seed?: number;
  stopSequences?: string;
  jsonMode?: boolean;
};

export type CropImageNodeData = BaseNodeData & {
  nodeType: "cropImage";
  imageUrl: string;
  xPercent: string;
  yPercent: string;
  widthPercent: string;
  heightPercent: string;
  outputImage?: string;
};

export type ResponseNodeData = BaseNodeData & {
  nodeType: "response";
  items: ResponseItem[];
};

export type WorkflowNodeData =
  | RequestNodeData
  | GeminiNodeData
  | CropImageNodeData
  | ResponseNodeData;

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;

export type NodeRun = {
  id?: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: WorkflowNodeType;
  status: WorkflowRunStatus;
  executionMs: number;
  inputs: string[];
  output?: string;
  error?: string;
  inputsJson?: Record<string, unknown>;
  outputsJson?: Record<string, unknown>;
  errorMessage?: string;
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  scope: WorkflowRunScope;
  status: WorkflowRunStatus;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  summary?: string;
  nodes: NodeRun[];
};
