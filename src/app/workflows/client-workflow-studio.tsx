"use client";

import dynamic from "next/dynamic";

const WorkflowStudio = dynamic(
  () => import("@/components/workflow/workflow-studio").then((module) => module.WorkflowStudio),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center text-sm text-secondary">Loading studio...</div>
      </div>
    ),
  },
);

export function ClientWorkflowStudio() {
  return <WorkflowStudio />;
}
