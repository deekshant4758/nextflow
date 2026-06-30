"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const candidateLinkedInUrl =
  process.env.NEXT_PUBLIC_CANDIDATE_LINKEDIN_URL ?? "https://www.linkedin.com/in/deekshant-gupta-986774202/";

export function CandidateLinkedInLog() {
  const pathname = usePathname();
  const loggedPathnameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (loggedPathnameRef.current === pathname) {
      return;
    }

    console.log(`[NextFlow] Candidate LinkedIn:${candidateLinkedInUrl}`);
    loggedPathnameRef.current = pathname;
  }, [pathname]);

  return null;
}
