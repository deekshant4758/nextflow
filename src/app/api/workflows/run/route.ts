import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message:
        "Server-side workflow execution is not wired to the new builder yet. The current builder executes from client state while the Trigger.dev migration is being completed.",
    },
    { status: 501 },
  );
}
