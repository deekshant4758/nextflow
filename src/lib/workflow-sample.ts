import type { WorkflowEdge, WorkflowNode, WorkflowRun } from "@/types/workflow";
import { resolveWorkflowNodes, styleEdge } from "@/lib/workflow-utils";

const sampleNodesBase: WorkflowNode[] = [
  {
    id: "request-10a7b2d5-b358-4bae-86c5-84fb08c22e24",
    type: "request",
    position: {
      x: -512.2767397309299,
      y: 76.0758509311418
    },
    deletable: false,
    data: {
      label: "Request-Inputs",
      nodeType: "request",
      fields: [
        {
          id: "field_2fab9597-32d1-48b6-93ad-f1db6f757d36",
          label: "text_field",
          type: "text_field",
          value: "Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design"
        },
        {
          id: "field_2d9eeba8-9814-437b-b128-0ddb23c19d91",
          label: "image_field",
          type: "image_field",
          value: "https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcSOubvsnSk6jCp3msQODNV3QVYZZG-IIhufJI6oMhfakE0E3YDBPBfhFPFfLvMiztziekcF-Pkm5FWfD8pLEv3yppF3-WSZm2ji1_wGgaqJnHIEHfTgDydeUA"
        }
      ]
    }
  },
  {
    id: "response-4420d2bb-f63e-4aac-acd8-904233afcb9a",
    type: "response",
    position: {
      x: 2003.8092693521817,
      y: 180.59136927072967
    },
    deletable: false,
    data: {
      label: "Response",
      nodeType: "response",
      items: [
        {
          id: "edge-3dcb1ce4-86bb-44ff-ae26-8c3679f1d948",
          sourceNodeId: "gemini-5e814f55-0053-45ca-aaaf-7331020df2c0",
          sourceNodeLabel: "Gemini 2.5 Flash",
          sourceHandle: "output",
          value: ""
        }
      ]
    }
  },
  {
    id: "gemini-cd74ea13-d443-4c09-a0f0-ce89ce8059ac",
    type: "gemini",
    position: {
      x: 79.71337339584059,
      y: -769.8227225758866
    },
    data: {
      label: "Gemini 2.5 Flash",
      nodeType: "gemini",
      model: "gemini-2.5-flash",
      prompt: "Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design",
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
      jsonMode: false
    }
  },
  {
    id: "crop-eafbdda7-1431-477e-908b-96a1b5e1fb54",
    type: "cropImage",
    position: {
      x: 142.4049023222982,
      y: -54.616942147085034
    },
    data: {
      label: "Crop Image",
      nodeType: "cropImage",
      imageUrl: "",
      xPercent: "20",
      yPercent: "20",
      widthPercent: "60",
      heightPercent: "60"
    }
  },
  {
    id: "crop-29ef3ef0-2142-4fae-9dcd-8e7b10e1325e",
    type: "cropImage",
    position: {
      x: 120.93340532698613,
      y: 794.4890777653085
    },
    data: {
      label: "Crop Image",
      nodeType: "cropImage",
      imageUrl: "",
      xPercent: "0",
      yPercent: "0",
      widthPercent: "100",
      heightPercent: "50"
    }
  },
  {
    id: "gemini-9bfac78c-8805-4ff0-bf97-7d3b85990e83",
    type: "gemini",
    position: {
      x: 714.0231734859924,
      y: -814.6809548994239
    },
    data: {
      label: "Gemini 2.5 Flash",
      nodeType: "gemini",
      model: "gemini-2.5-flash",
      prompt: "",
      systemPrompt: "Condense the following product description into a tweet-length hook (under 240 characters).",
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
      jsonMode: false
    }
  },
  {
    id: "gemini-5e814f55-0053-45ca-aaaf-7331020df2c0",
    type: "gemini",
    position: {
      x: 1293.8194550640553,
      y: -144.66253910702795
    },
    data: {
      label: "Gemini 2.5 Flash",
      nodeType: "gemini",
      model: "gemini-2.5-flash",
      prompt: "",
      systemPrompt: "You are a social media manager.\nCombine the tweet hook and the two product crops into a final marketing post.",
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
      jsonMode: false
    }
  }
];

const sampleEdgesBase: WorkflowEdge[] = [
  {
    source: "request-10a7b2d5-b358-4bae-86c5-84fb08c22e24",
    sourceHandle: "field_2fab9597-32d1-48b6-93ad-f1db6f757d36",
    target: "gemini-cd74ea13-d443-4c09-a0f0-ce89ce8059ac",
    targetHandle: "prompt",
    id: "edge-9398e672-3582-4437-b8a8-83a4abdd37ba"
  },
  {
    source: "request-10a7b2d5-b358-4bae-86c5-84fb08c22e24",
    sourceHandle: "field_2d9eeba8-9814-437b-b128-0ddb23c19d91",
    target: "crop-eafbdda7-1431-477e-908b-96a1b5e1fb54",
    targetHandle: "input_image",
    id: "edge-74e14071-0dc2-4afe-8d5b-c9fa10b23955"
  },
  {
    source: "request-10a7b2d5-b358-4bae-86c5-84fb08c22e24",
    sourceHandle: "field_2d9eeba8-9814-437b-b128-0ddb23c19d91",
    target: "crop-29ef3ef0-2142-4fae-9dcd-8e7b10e1325e",
    targetHandle: "input_image",
    id: "edge-2a65afc0-0ea1-48f8-aa5d-961fc56af786"
  },
  {
    source: "gemini-cd74ea13-d443-4c09-a0f0-ce89ce8059ac",
    sourceHandle: "output",
    target: "gemini-9bfac78c-8805-4ff0-bf97-7d3b85990e83",
    targetHandle: "prompt",
    id: "edge-f302f9f3-72c9-4b14-b7a9-d8f335833ba3"
  },
  {
    source: "crop-eafbdda7-1431-477e-908b-96a1b5e1fb54",
    sourceHandle: "output_image",
    target: "gemini-5e814f55-0053-45ca-aaaf-7331020df2c0",
    targetHandle: "image_vision",
    id: "edge-503715f0-ce56-49c1-a02d-40261e03e08a"
  },
  {
    source: "crop-29ef3ef0-2142-4fae-9dcd-8e7b10e1325e",
    sourceHandle: "output_image",
    target: "gemini-5e814f55-0053-45ca-aaaf-7331020df2c0",
    targetHandle: "image_vision",
    id: "edge-07fb18ea-f4f0-44ac-b39a-01fb43430576"
  },
  {
    source: "gemini-9bfac78c-8805-4ff0-bf97-7d3b85990e83",
    sourceHandle: "output",
    target: "gemini-5e814f55-0053-45ca-aaaf-7331020df2c0",
    targetHandle: "prompt",
    id: "edge-2b79d614-19f5-4185-aa6d-cf148c7591ed"
  },
  {
    source: "gemini-5e814f55-0053-45ca-aaaf-7331020df2c0",
    sourceHandle: "output",
    target: "response-4420d2bb-f63e-4aac-acd8-904233afcb9a",
    targetHandle: "result",
    id: "edge-3dcb1ce4-86bb-44ff-ae26-8c3679f1d948"
  }
];

const sampleNodes = resolveWorkflowNodes(
  structuredClone(sampleNodesBase),
  sampleEdgesBase.map((edge) => styleEdge(edge, sampleNodesBase)),
);
const sampleEdges = sampleEdgesBase.map((edge) => styleEdge(edge, sampleNodes));

export const workflowTemplates = [
  {
    id: "simple-llm-workflow",
    name: "sample workflow",
    description: "A comprehensive sample workflow with Gemini generation and image cropping.",
    nodes: resolveWorkflowNodes(structuredClone(sampleNodes), structuredClone(sampleEdges)),
    edges: structuredClone(sampleEdges),
    runs: [] as WorkflowRun[],
  },
];

export { sampleNodes, sampleEdges };
