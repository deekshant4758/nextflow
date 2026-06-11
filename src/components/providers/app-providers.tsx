"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";

type AppProvidersProps = {
  children: React.ReactNode;
};

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export function AppProviders({ children }: AppProvidersProps) {
  const content = <ThemeProvider attribute="class" forcedTheme="dark">{children}</ThemeProvider>;

  if (!hasClerk) {
    return content;
  }

  return <ClerkProvider>{content}</ClerkProvider>;
}
