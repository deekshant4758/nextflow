"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  EllipsisVertical,
  ExternalLink,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  Copy,
  Trash2,
  Upload,
} from "lucide-react";
import { useWorkflowStudioStore } from "@/components/workflow/workflow-store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Per-card dropdown (uses shadcn DropdownMenu) ─────────────────────────────
function WorkflowCardMenu({
  onOpen,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
}: {
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* Matches reference: rounded-md bg-white/80 p-1, hidden until group hover */}
        <button
          type="button"
          className="rounded-md bg-white/80 p-1 text-muted-foreground opacity-0 transition-all group-hover/card:opacity-100 hover:bg-white hover:text-foreground focus:opacity-100 dark:bg-black/50 dark:hover:bg-black/70"
          onClick={(e) => e.stopPropagation()}
        >
          <EllipsisVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onOpen}>
          <ExternalLink />
          Open
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRename}>
          <Pencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExport}>
          <Download />
          Export JSON
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
        >
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Main dashboard ────────────────────────────────────────────────────────────
export function WorkflowsDashboard() {
  const router = useRouter();
  const initialized = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const {
    initialize,
    workflows,
    selectWorkflow,
    createWorkflow,
    deleteWorkflow,
    renameWorkflowById,
    duplicateWorkflow,
    importWorkflow,
  } = useWorkflowStudioStore();

  useEffect(() => {
    if (initialized.current) return;
    initialize();
    initialized.current = true;
  }, [initialize]);

  const sortedWorkflows = useMemo(
    () =>
      [...workflows]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .filter((w) => w.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [workflows, searchQuery],
  );

  const createAndOpenWorkflow = () => {
    const workflowId = createWorkflow();
    router.push(`/workflows/${workflowId}`);
  };

  const handleExport = (workflow: (typeof workflows)[number]) => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(
        JSON.stringify({ name: workflow.name, nodes: workflow.nodes, edges: workflow.edges }, null, 2),
      );
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `${workflow.name.toLowerCase().replace(/\s+/g, "_")}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const name = data.name || file.name.replace(/\.json$/, "");
        const newId = importWorkflow(name, data.nodes || [], data.edges || []);
        router.push(`/workflows/${newId}`);
      } catch {
        alert("Invalid workflow JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const formatEditTime = (date: string) => {
    const now = new Date();
    const edited = new Date(date);
    const diffMs = now.getTime() - edited.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const workflowToDelete = workflows.find((w) => w.id === deleteDialogId);

  return (
    <div className="flex min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
      {/* ─── Delete confirmation dialog ─────────────────────────────────── */}
      <AlertDialog
        open={!!deleteDialogId}
        onOpenChange={(open) => { if (!open) setDeleteDialogId(null); }}
      >
        <AlertDialogContent className="!rounded-3xl !w-auto !max-w-[420px] !p-0 overflow-hidden bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-xl gap-0">
          <div className="px-6 pt-6 pb-6">
            <AlertDialogTitle className="text-base font-semibold text-gray-900 dark:text-white mb-1.5">
              Delete Workflow
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">
              Are you sure you want to delete &ldquo;{workflowToDelete?.name}&rdquo;?
              This action cannot be undone.
            </AlertDialogDescription>
            <div className="flex justify-end gap-2 mt-5">
              <AlertDialogCancel className="!rounded-full h-10 px-6 text-sm border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 font-medium shadow-none">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="!rounded-full h-10 px-6 text-sm bg-red-600 hover:bg-red-700 text-white font-semibold border-0 shadow-none"
                onClick={() => {
                  if (deleteDialogId) deleteWorkflow(deleteDialogId);
                  setDeleteDialogId(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen w-full bg-background">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">

          {/* ─── Header ──────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="inline-flex min-w-0 items-center gap-2">
                <div className="min-w-0">
                  <div className="text-xl font-semibold text-foreground sm:text-2xl">Flow</div>
                  <div className="mt-0.5 text-xs text-muted-foreground sm:mt-1 sm:text-sm">
                    Build workflows or run models directly.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Import button */}
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground/80 transition-colors hover:bg-muted disabled:opacity-40 sm:gap-2 sm:px-3"
                title="Import workflow JSON"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Import</span>
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportFile}
              />

              {/* New workflow button */}
              <button
                type="button"
                onClick={createAndOpenWorkflow}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 sm:gap-2 sm:px-3"
                title="Create a new workflow"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="hidden xs:inline">New workflow</span>
              </button>
            </div>
          </div>

          {/* ─── Workflow grid ────────────────────────────────────────────── */}
          <div className="mt-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">Your Workflows</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Open one to edit, run, and review history.
                </div>
              </div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  placeholder="Search workflows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 sm:w-52"
                  type="text"
                />
              </div>
            </div>

            {sortedWorkflows.length === 0 ? (
              <div className="mt-4 rounded-xl border border-border bg-muted/40 p-8">
                <div className="text-sm font-medium text-foreground">No workflows found</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {workflows.length === 0
                    ? "Start with a new workflow."
                    : "Try adjusting your search."}
                </div>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {sortedWorkflows.map((workflow) => (
                  <div key={workflow.id} className="group/card relative max-w-[250px]">

                    {/* Thumbnail card */}
                    <div className="relative overflow-hidden rounded-xl border border-border shadow-sm transition-colors hover:border-primary/30">
                      <Link
                        href={`/workflows/${workflow.id}`}
                        onClick={() => selectWorkflow(workflow.id)}
                        className="block aspect-[250/162] bg-muted dark:bg-card"
                      >
                        <img
                          src="https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=400&q=80"
                          alt={workflow.name}
                          className="h-full w-full object-cover"
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                        />
                      </Link>
                    </div>

                    {/* Top-left: change thumbnail button (hover only) */}
                    <div className="absolute left-2 top-2 z-10">
                      <button
                        type="button"
                        className="rounded-md bg-white/80 p-1 text-muted-foreground opacity-0 transition-all group-hover/card:opacity-100 hover:bg-white hover:text-foreground focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-black/50 dark:hover:bg-black/70"
                        title="Change thumbnail"
                      >
                        <ImagePlus className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    {/* Top-right: three-dot dropdown (hover only) */}
                    <div className="absolute right-2 top-2 z-10">
                      <WorkflowCardMenu
                        onOpen={() => {
                          selectWorkflow(workflow.id);
                          router.push(`/workflows/${workflow.id}`);
                        }}
                        onRename={() => {
                          setRenamingId(workflow.id);
                          setRenameValue(workflow.name);
                        }}
                        onDuplicate={() => duplicateWorkflow(workflow.id)}
                        onExport={() => handleExport(workflow)}
                        onDelete={() => setDeleteDialogId(workflow.id)}
                      />
                    </div>

                    {/* Name + timestamp */}
                    <div className="mt-2 px-1">
                      {renamingId === workflow.id ? (
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => {
                            renameWorkflowById(workflow.id, renameValue);
                            setRenamingId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              renameWorkflowById(workflow.id, renameValue);
                              setRenamingId(null);
                            }
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-sm font-medium text-foreground outline-none focus:border-primary"
                          autoFocus
                        />
                      ) : (
                        <>
                          <div
                            className="truncate text-sm font-medium text-foreground"
                            title={workflow.name}
                          >
                            {workflow.name}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            Edited {formatEditTime(workflow.updatedAt)}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
