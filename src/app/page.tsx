import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { featureFlags } from "@/lib/env";

export default async function HomePage() {
  if (!featureFlags.clerk) {
    redirect("/workflows");
  }

  const { userId } = await auth();

  redirect(userId ? "/workflows" : "/sign-in");
}
