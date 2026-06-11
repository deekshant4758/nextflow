import type { Edge, Node } from "@xyflow/react";

export type WorkflowNodeType =
  | "text"
  | "uploadImage"
  | "uploadVideo"
  | "runLLM"
  | "generateImage"
  | "cropImage"
  | "extractFrame";

export type DataKind = "text" | "image" | "video";

export type ConnectionHandle =
  | "output"
  | "system_prompt"
  | "user_message"
  | "images"
  | "image_url"
  | "video_url"
  | "timestamp"
  | "x_percent"
  | "y_percent"
  | "width_percent"
  | "height_percent";

export type WorkflowRunStatus = "success" | "failed" | "running" | "partial";
export type WorkflowRunScope = "full" | "selected" | "single";

export type BaseNodeData = {
  label: string;
  nodeType: WorkflowNodeType;
  description: string;
  outputKind?: DataKind;
  running?: boolean;
  result?: string;
};

export type TextNodeData = BaseNodeData & {
  nodeType: "text";
  text: string;
  role?: "system" | "message" | "value";
  outputKind: "text";
};

export type UploadImageNodeData = BaseNodeData & {
  nodeType: "uploadImage";
  fileName?: string;
  imageUrl?: string;
  outputKind: "image";
};

export type UploadVideoNodeData = BaseNodeData & {
  nodeType: "uploadVideo";
  fileName?: string;
  videoUrl?: string;
  outputKind: "video";
};

export type RunLlmNodeData = BaseNodeData & {
  nodeType: "runLLM";
  model: string;
  systemPrompt: string;
  userMessage: string;
  acceptedImageCount: number;
  connectedImages: string[];
  validationError?: string;
  outputKind: "text";
};

export type GenerateImageNodeData = BaseNodeData & {
  nodeType: "generateImage";
  model: string;
  systemPrompt: string;
  userMessage: string;
  connectedImages: string[];
  validationError?: string;
  outputKind: "image";
};

export type CropImageNodeData = BaseNodeData & {
  nodeType: "cropImage";
  imageUrl: string;
  xPercent: string;
  yPercent: string;
  widthPercent: string;
  heightPercent: string;
  outputKind: "image";
};

export type ExtractFrameNodeData = BaseNodeData & {
  nodeType: "extractFrame";
  videoUrl: string;
  timestamp: string;
  outputKind: "image";
};

export type WorkflowNodeData =
  | TextNodeData
  | UploadImageNodeData
  | UploadVideoNodeData
  | RunLlmNodeData
  | GenerateImageNodeData
  | CropImageNodeData
  | ExtractFrameNodeData;

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;

export type NodeRun = {
  nodeId: string;
  nodeLabel: string;
  nodeType: WorkflowNodeType;
  status: WorkflowRunStatus;
  executionMs: number;
  inputs: string[];
  output?: string;
  error?: string;
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  scope: WorkflowRunScope;
  status: WorkflowRunStatus;
  startedAt: string;
  durationMs: number;
  summary: string;
  nodeRuns: NodeRun[];
};
