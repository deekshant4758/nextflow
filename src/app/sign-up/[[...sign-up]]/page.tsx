import { SignUp } from "@clerk/nextjs";
import { featureFlags } from "@/lib/env";

export default function SignUpPage() {
  if (!featureFlags.clerk) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div className="max-w-xl rounded-[28px] border border-white/10 bg-white/5 p-10">
          <h1 className="text-3xl font-semibold tracking-[-0.05em] text-white">Clerk keys are missing</h1>
          <p className="mt-4 text-sm leading-7 text-secondary">
            Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `.env.local` to enable sign up.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <SignUp />
    </main>
  );
}
