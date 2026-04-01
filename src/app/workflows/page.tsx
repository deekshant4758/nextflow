import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ClientWorkflowStudio } from "@/app/workflows/client-workflow-studio";
import { featureFlags } from "@/lib/env";

export default async function WorkflowsPage() {
  if (featureFlags.clerk) {
    const { userId } = await auth();

    if (!userId) {
      redirect("/sign-in?redirect_url=/workflows");
    }
  }

  return <ClientWorkflowStudio />;
}
