"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  MessageSquareMore,
  FolderOpen,
  Library,
  Boxes,
  BookOpen,
  Settings,
  Gift,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { featureFlags } from "@/lib/env";
import { UserButton, useUser } from "@clerk/nextjs";
import { useWorkflowStudioStore } from "@/components/workflow/workflow-store";


function NextflowIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="256" height="256" rx="56" fill="#0B0D14" />
      <path d="M72 72 C72 120 112 120 128 128 C144 136 184 136 184 184" fill="none" stroke="#F8FAFC" strokeWidth="22" strokeLinecap="round" />
      <path d="M184 72 C184 120 144 120 128 128 C112 136 72 136 72 184" fill="none" stroke="#8B5CF6" strokeWidth="22" strokeLinecap="round" />
    </svg>
  );
}

function ArrowsSplitIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 17h-8l-3.5 -5h-6.5" />
      <path d="M21 7h-8l-3.495 5" />
      <path d="M18 10l3 -3l-3 -3" />
      <path d="M18 20l3 -3l-3 -3" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const createWorkflow = useWorkflowStudioStore((state) => state.createWorkflow);
  const [showFooterDetails, setShowFooterDetails] = useState(false);

  const { user } = useUser();
  const displayName = user
    ? (user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "User")
    : "User";

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) setIsCollapsed(saved === "true");
  }, []);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  const handleCreateWorkflow = () => {
    const workflowId = createWorkflow();
    router.push(`/workflows/${workflowId}`);
  };

  const navLinks = [
    { href: "/workflows", label: "Task", icon: <MessageSquareMore className="h-4 w-4" /> },
    { href: "/workflows", label: "Projects", icon: <FolderOpen className="h-4 w-4" /> },
    { href: "/workflows", label: "Library", icon: <Library className="h-4 w-4" /> },
    { href: "/workflows", label: "Flow", icon: <ArrowsSplitIcon className="h-4 w-4" /> },
    { href: "/workflows", label: "Nodes", icon: <Boxes className="h-4 w-4" /> },
    { href: "https://magica.com/docs", label: "API Docs / MCP", icon: <BookOpen className="h-4 w-4" />, isExternal: true },
  ];

  return (
    <aside
      className={`relative flex flex-shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 transition-all duration-300 ease-in-out ${isCollapsed ? "w-[52px]" : "w-[265px]"
        }`}
    >
      {/* ─── Collapsed State ─── */}
      <div className={`h-full flex-col items-center py-3 ${isCollapsed ? "flex" : "hidden"}`}>
        <button
          type="button"
          onClick={toggleCollapse}
          className="relative inline-flex items-center justify-center rounded-lg h-8 w-8 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors group/logo-btn mb-5 mt-1"
          title="Expand sidebar"
        >
          <NextflowIcon className="h-5 w-5 transition-opacity duration-200 group-hover/logo-btn:opacity-0" />
          <PanelLeftOpen className="absolute inset-0 m-auto h-4 w-4 opacity-0 transition-opacity duration-200 group-hover/logo-btn:opacity-100 text-gray-500" />
        </button>

        <div className="flex flex-col items-center gap-1 w-full px-2">
          <button
            type="button"
            onClick={handleCreateWorkflow}
            className="inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white h-8 w-8"
            title="New task"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white h-8 w-8"
            title="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          <div className="w-6 h-px bg-gray-200 dark:bg-zinc-800 my-2" />

          {navLinks.map((link) => {
            const isActive = link.label === "Flow" && pathname === "/workflows";
            return link.isExternal ? (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                className={`inline-flex items-center justify-center rounded-lg h-8 w-8 transition-colors ${isActive ? "text-gray-900 dark:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  }`}
                title={link.label}
              >
                {link.icon}
              </a>
            ) : (
              <Link key={link.label} href={link.href}
                className={`inline-flex items-center justify-center rounded-lg h-8 w-8 transition-colors ${isActive ? "text-gray-900 dark:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  }`}
                title={link.label}
              >
                {link.icon}
              </Link>
            );
          })}
        </div>

        <div className="mt-auto pb-3">
          {featureFlags.clerk ? (
            <UserButton />
          ) : (
            <div className="h-7 w-7 rounded-full bg-[#8B5CF6] text-white flex items-center justify-center">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* ─── Expanded State ─── */}
      <div className={`h-full flex-col ${isCollapsed ? "hidden" : "flex"} w-[265px]`}>

        {/* Header */}
        <div className="flex h-[52px] items-center justify-between px-4">
          <Link href="/workflows" className="flex items-center gap-2">
            <NextflowIcon className="h-5 w-5" />
            <span className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
              NextFlow
            </span>
          </Link>
          <button
            type="button"
            onClick={toggleCollapse}
            className="inline-flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 h-7 w-7 transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col px-2 pb-1">
          <button
            type="button"
            onClick={handleCreateWorkflow}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
          >
            <Plus className="h-4 w-4 flex-shrink-0" />
            New task
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
          >
            <Search className="h-4 w-4 flex-shrink-0" />
            Search Task
          </button>
        </div>

        {/* Nav Links */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3">
          <div className="flex flex-col gap-0.5">
            {navLinks.map((link) => {
              const isActive = link.label === "Flow" && pathname === "/workflows";
              const cls = `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${isActive
                ? "text-gray-900 font-semibold dark:text-white"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white font-normal"
                }`;
              return link.isExternal ? (
                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
                  {link.icon}
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} href={link.href} className={cls}>
                  {link.icon}
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-4 text-xs text-center text-gray-400 dark:text-zinc-600">
            No tasks yet
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 dark:border-zinc-800 p-3 flex flex-col gap-2">

          {/* Collapsible Settings + Claim Offer */}
          <div className={`transition-all duration-300 ease-in-out overflow-hidden flex flex-col gap-2 ${showFooterDetails ? "max-h-32 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
            }`}>
            <button
              type="button"
className="inline-flex items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors w-full"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-full font-medium h-9 w-full text-xs text-white bg-violet-500 hover:bg-violet-600 transition-colors"
            >
              <Gift className="h-4 w-4" />
              Claim Offer
            </button>
          </div>

          {/* Chevron toggle */}
          <button
            type="button"
            onClick={() => setShowFooterDetails(!showFooterDetails)}
            className="w-full py-0.5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            {showFooterDetails ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>

          {/* User profile — centered */}
          <div className="flex items-center justify-center pb-1">
            {featureFlags.clerk ? (
              <UserButton showName appearance={{
                elements: { userButtonOuterIdentifier: "text-gray-600 dark:text-gray-400 font-medium text-xs" }
              }} />
            ) : (
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                <div className="h-7 w-7 rounded-full bg-[#8B5CF6] flex-shrink-0 text-white flex items-center justify-center">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700 dark:text-zinc-300">{displayName}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}