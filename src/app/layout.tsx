import type { Metadata } from "next";
import { CandidateLinkedInLog } from "@/components/app/candidate-linkedin-log";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "NextFlow",
  description: "NextFlow is a creative workflow studio for image, video, and text work.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased" suppressHydrationWarning>
        <AppProviders>
          <CandidateLinkedInLog />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
