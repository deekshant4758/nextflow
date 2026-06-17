"use client";

import { Sidebar } from "@/components/workflow/sidebar";

export default function WorkflowsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 overflow-hidden min-w-0">
        {children}
      </div>
    </div>
  );
}
