import type { WorkflowEdge, WorkflowNode, WorkflowRun } from "@/types/workflow";
import { resolveWorkflowNodes, styleEdge } from "@/lib/workflow-utils";

function field(id: string, label: string, type: "text_field" | "image_field", value: string) {
  return { id, label, type, value };
}

const sampleNodesBase: WorkflowNode[] = [
  {
    id: "request-node",
    type: "request",
    position: { x: 100, y: 200 },
    deletable: false,
    data: {
      label: "Request-Inputs",
      nodeType: "request",
      fields: [
        field(
          "prompt",
          "Prompt",
          "text_field",
          "Tell me a fun fact about space",
        ),
      ],
    },
  },
  {
    id: "gemini-1",
    type: "gemini",
    position: { x: 550, y: 150 },
    data: {
      label: "Gemini 2.5 Flash",
      nodeType: "gemini",
      model: "gemini-2.5-flash",
      prompt: "",
      systemPrompt: "You are a helpful assistant.",
      response: "",
      settingsOpen: false,
    },
  },
  {
    id: "response-node",
    type: "response",
    position: { x: 1000, y: 200 },
    deletable: false,
    data: {
      label: "Response",
      nodeType: "response",
      items: [],
    },
  },
];

const sampleEdgesBase: WorkflowEdge[] = [
  { id: "e1", source: "request-node", sourceHandle: "prompt", target: "gemini-1", targetHandle: "prompt" },
  { id: "e2", source: "gemini-1", sourceHandle: "output", target: "response-node", targetHandle: "result" },
];

const sampleNodes = resolveWorkflowNodes(
  structuredClone(sampleNodesBase),
  sampleEdgesBase.map((edge) => styleEdge(edge, sampleNodesBase)),
);
const sampleEdges = sampleEdgesBase.map((edge) => styleEdge(edge, sampleNodes));

export const workflowTemplates = [
  {
    id: "simple-llm-workflow",
    name: "Sample Workflow",
    description: "A simple 3-node workflow template.",
    nodes: resolveWorkflowNodes(structuredClone(sampleNodes), structuredClone(sampleEdges)),
    edges: structuredClone(sampleEdges),
    runs: [] as WorkflowRun[],
  },
];

export { sampleNodes, sampleEdges };
