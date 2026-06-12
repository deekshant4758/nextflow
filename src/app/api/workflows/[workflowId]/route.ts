import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { featureFlags } from "@/lib/env";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  nodesJson: z.any().optional(),
  edgesJson: z.any().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  if (!featureFlags.database) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL is not configured." }, { status: 400 });
  }

  const { workflowId } = await params;
  const body = await request.json();
  const payload = updateSchema.parse(body);

  let userId = "anonymous";
  try {
    const session = await auth();
    if (session?.userId) {
      userId = session.userId;
    }
  } catch (e) {}

  // Update in DB
  const workflow = await prisma.workflow.updateMany({
    where: { id: workflowId, userId },
    data: payload,
  });

  return NextResponse.json({ ok: true, workflow });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  if (!featureFlags.database) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL is not configured." }, { status: 400 });
  }

  const { workflowId } = await params;

  let userId = "anonymous";
  try {
    const session = await auth();
    if (session?.userId) {
      userId = session.userId;
    }
  } catch (e) {}

  await prisma.workflow.deleteMany({
    where: { id: workflowId, userId },
  });

  return NextResponse.json({ ok: true });
}
