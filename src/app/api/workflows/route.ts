import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { featureFlags } from "@/lib/env";

const workflowSchema = z.object({
  userId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  nodesJson: z.any(),
  edgesJson: z.any(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const payload = workflowSchema.parse(body);

  if (!featureFlags.database) {
    return NextResponse.json({ ok: false, message: "DATABASE_URL is not configured." }, { status: 400 });
  }

  const workflow = await prisma.workflow.create({
    data: payload,
  });

  return NextResponse.json({ ok: true, workflow });
}
