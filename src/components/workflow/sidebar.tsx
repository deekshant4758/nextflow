"use client";

import { useEffect, useState, useRef } from "react";
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
import { UserButton, useUser, useClerk } from "@clerk/nextjs";
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

function UserFooter({ displayName, userEmail, clerkEnabled }: {
  displayName: string;
  userEmail: string;
  clerkEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { signOut } = useClerk();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popupPos, setPopupPos] = useState({ bottom: 0, left: 0, width: 0 });

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPopupPos({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        width: Math.max(rect.width, 240),
      });
    }
    setOpen(true);
  };

  return (
    <div className="relative w-full">
      {/* Fixed popup — escapes sidebar overflow:hidden */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Popup */}
          <div
            className="fixed z-50 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden"
            style={{
              bottom: popupPos.bottom,
              left: popupPos.left,
              width: popupPos.width,
            }}
          >
            {/* User info */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="h-9 w-9 rounded-full bg-[#8B5CF6] flex-shrink-0 text-white flex items-center justify-center">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{displayName}</div>
                {userEmail && (
                  <div className="text-xs text-gray-500 dark:text-zinc-400 truncate">{userEmail}</div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-zinc-800" />

            {/* Actions */}
            <div className="py-1.5">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                onClick={() => setOpen(false)}
              >
                <Settings className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
                Manage account
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                onClick={async () => {
                  setOpen(false);
                  await signOut({ redirectUrl: "/" });
                }}
              >
                <svg className="h-4 w-4 text-gray-400 dark:text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors w-full"
      >
        <div className="h-7 w-7 rounded-full bg-[#8B5CF6] flex-shrink-0 text-white flex items-center justify-center">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        </div>
        <span className="text-sm text-gray-700 dark:text-zinc-300">{displayName}</span>
      </button>
    </div>
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
  const userEmail = user?.primaryEmailAddress?.emailAddress || "";

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
    // ⚠️ KEY FIX: removed overflow-hidden — it was clipping the fixed popup
    <aside
      className={`relative flex flex-shrink-0 flex-col border-r border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-[52px]" : "w-[265px]"
      }`}
    >
      {/* ─── Collapsed State ─── */}
      <div className={`h-full flex-col items-center py-3 overflow-hidden ${isCollapsed ? "flex" : "hidden"}`}>
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
                className={`inline-flex items-center justify-center rounded-lg h-8 w-8 transition-colors ${
                  isActive ? "text-gray-900 dark:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                }`}
                title={link.label}
              >
                {link.icon}
              </a>
            ) : (
              <Link key={link.label} href={link.href}
                className={`inline-flex items-center justify-center rounded-lg h-8 w-8 transition-colors ${
                  isActive ? "text-gray-900 dark:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
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
      <div className={`h-full flex-col overflow-hidden ${isCollapsed ? "hidden" : "flex"} w-[265px]`}>

        {/* Header */}
        <div className="flex h-[52px] items-center justify-between px-4 flex-shrink-0">
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
        <div className="flex flex-col px-2 pb-1 flex-shrink-0">
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
              const cls = `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
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
          <div className={`transition-all duration-300 ease-in-out overflow-hidden flex flex-col gap-2 ${
            showFooterDetails ? "max-h-32 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
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

          {/* User profile */}
          <UserFooter
            displayName={displayName}
            userEmail={userEmail}
            clerkEnabled={featureFlags.clerk}
          />
        </div>
      </div>
    </aside>
  );
}