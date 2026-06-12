import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { featureFlags } from "@/lib/env";
import { auth } from "@clerk/nextjs/server";

const workflowSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  nodesJson: z.any(),
  edgesJson: z.any(),
});

export async function GET() {
  if (!featureFlags.database) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL is not configured." }, { status: 400 });
  }

  let userId = "anonymous";
  try {
    const session = await auth();
    if (session?.userId) {
      userId = session.userId;
    }
  } catch (e) {}

  const workflows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ ok: true, workflows });
}

export async function POST(request: Request) {
  const body = await request.json();
  const payload = workflowSchema.parse(body);

  if (!featureFlags.database) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL is not configured." }, { status: 400 });
  }

  let userId = payload.userId;
  try {
    const session = await auth();
    if (session?.userId) {
      userId = session.userId;
    }
  } catch (e) {}

  const workflow = await prisma.workflow.create({
    data: {
      id: payload.id,
      userId,
      name: payload.name,
      description: payload.description,
      nodesJson: payload.nodesJson,
      edgesJson: payload.edgesJson,
    },
  });

  return NextResponse.json({ ok: true, workflow });
}
