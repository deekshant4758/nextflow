import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { featureFlags } from "@/lib/env";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { WorkflowRunScope, WorkflowRunStatus } from "@prisma/client";

const runSchema = z.object({
  id: z.string(),
  scope: z.enum(["FULL", "SELECTED", "SINGLE", "full", "selected", "single"]),
  status: z.enum(["SUCCESS", "FAILED", "RUNNING", "PARTIAL", "success", "failed", "running", "partial"]),
  durationMs: z.number(),
  startedAt: z.string(),
  summary: z.string().optional(),
  nodes: z.array(
    z.object({
      nodeId: z.string(),
      nodeLabel: z.string(),
      nodeType: z.string(),
      status: z.enum(["SUCCESS", "FAILED", "RUNNING", "PARTIAL", "success", "failed", "running", "partial"]),
      executionMs: z.number(),
      inputs: z.array(z.string()).optional(),
      output: z.any().optional(),
      error: z.string().optional(),
    })
  ),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  if (!featureFlags.database) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL is not configured." }, { status: 400 });
  }

  const { workflowId } = await params;

  const runs = await prisma.workflowRun.findMany({
    where: { workflowId },
    include: { nodes: true },
    orderBy: { startedAt: "desc" },
  });

  // Map database run records back to the format expected by our client state
  const clientRuns = runs.map((run) => ({
    id: run.id,
    workflowId: run.workflowId,
    scope: run.scope.toLowerCase(),
    status: run.status.toLowerCase(),
    startedAt: run.startedAt.toISOString(),
    durationMs: run.durationMs,
    summary: run.summary,
    nodes: run.nodes.map((nodeRun) => ({
      id: nodeRun.id,
      nodeId: nodeRun.nodeId,
      nodeLabel: nodeRun.nodeLabel,
      nodeType: nodeRun.nodeType,
      status: nodeRun.status.toLowerCase(),
      executionMs: nodeRun.executionMs,
      inputs: nodeRun.inputsJson ? (nodeRun.inputsJson as string[]) : undefined,
      output: nodeRun.outputsJson ?? undefined,
      error: nodeRun.errorMessage || undefined,
    })),
  }));

  return NextResponse.json({ ok: true, runs: clientRuns });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  if (!featureFlags.database) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL is not configured." }, { status: 400 });
  }

  const { workflowId } = await params;
  const body = await request.json();
  const payload = runSchema.parse(body);

  let userId = "anonymous";
  try {
    const session = await auth();
    if (session?.userId) {
      userId = session.userId;
    }
  } catch (e) {}

  const mapStatus = (s: string): WorkflowRunStatus => {
    const upper = s.toUpperCase();
    if (upper === "SUCCESS") return WorkflowRunStatus.SUCCESS;
    if (upper === "FAILED") return WorkflowRunStatus.FAILED;
    if (upper === "RUNNING") return WorkflowRunStatus.RUNNING;
    return WorkflowRunStatus.PARTIAL;
  };

  const mapScope = (s: string): WorkflowRunScope => {
    const upper = s.toUpperCase();
    if (upper === "FULL") return WorkflowRunScope.FULL;
    if (upper === "SELECTED") return WorkflowRunScope.SELECTED;
    return WorkflowRunScope.SINGLE;
  };

  // Ensure the workflow exists in the DB (it may only exist in localStorage)
  await prisma.workflow.upsert({
    where: { id: workflowId },
    create: {
      id: workflowId,
      userId,
      name: "Untitled",
      nodesJson: [],
      edgesJson: [],
    },
    update: {},
  });

  // Create the run and nested node executions in the DB
  const run = await prisma.workflowRun.create({
    data: {
      id: payload.id,
      workflowId,
      userId,
      scope: mapScope(payload.scope),
      status: mapStatus(payload.status),
      durationMs: payload.durationMs,
      startedAt: new Date(payload.startedAt),
      summary: payload.summary || "",
      nodes: {
        create: payload.nodes.map((n) => ({
          nodeId: n.nodeId,
          nodeLabel: n.nodeLabel,
          nodeType: n.nodeType,
          status: mapStatus(n.status),
          executionMs: n.executionMs,
          inputsJson: n.inputs ?? undefined,
          outputsJson: n.output != null ? n.output : undefined,
          errorMessage: n.error || null,
        })),
      },
    },
    include: { nodes: true },
  });

  return NextResponse.json({ ok: true, run });
}
