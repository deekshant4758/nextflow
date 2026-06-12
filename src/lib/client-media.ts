"use client";

import type { WorkflowNode, WorkflowRun } from "@/types/workflow";

export async function materializeMediaOutputs(nodes: WorkflowNode[], run: WorkflowRun) {
  return { nodes, run };
}
