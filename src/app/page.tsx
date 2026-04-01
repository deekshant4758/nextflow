import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Crop,
  FileImage,
  FileText,
  Film,
  PanelLeftClose,
  Sparkles,
  WandSparkles,
} from "lucide-react";

const navItems = [
  { label: "App", href: "/workflows" },
  { label: "Features", href: "#overview" },
  { label: "Nodes", href: "#nodes" },
  { label: "Flow", href: "#how-it-works" },
  { label: "Access", href: "#cta" },
];

const features = [
  {
    title: "Create Faster",
    description: "Build image, video, and writing workflows in one place without breaking your flow.",
    eyebrow: "Workspace",
  },
  {
    title: "Run with Confidence",
    description: "Start a workflow, follow what happened, and understand every result without leaving the builder.",
    eyebrow: "Execution",
  },
  {
    title: "Pick Up Where You Left Off",
    description: "Keep your workflows organized, revisit past runs, and come back to your workspace anytime.",
    eyebrow: "History",
  },
];

const quickAccess = [
  { label: "Text", icon: <FileText className="h-5 w-5" /> },
  { label: "Upload Image", icon: <FileImage className="h-5 w-5" /> },
  { label: "Upload Video", icon: <Film className="h-5 w-5" /> },
  { label: "Run Any LLM", icon: <Bot className="h-5 w-5" /> },
  { label: "Crop Image", icon: <Crop className="h-5 w-5" /> },
  { label: "Extract Frame", icon: <Sparkles className="h-5 w-5" /> },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="glass-panel fixed inset-x-0 top-0 z-50 border-b border-white/6 shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
        <div className="mx-auto flex h-16 w-full max-w-[1920px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-10">
            <span className="text-xl font-bold tracking-[-0.08em] text-white">NextFlow</span>
            <div className="hidden items-center gap-6 md:flex">
              {navItems.map((item, index) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={index === 0 ? "border-b-2 border-white pb-1 text-sm font-medium text-white" : "text-sm font-medium text-secondary transition-colors hover:text-white"}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/workflows"
              className="rounded-full border border-white/22 bg-[#2a2a2e] px-5 py-2 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:bg-[#34343a]"
              style={{ color: "#ffffff", backgroundColor: "#2a2a2e", borderColor: "rgba(255,255,255,0.22)" }}
            >
              Open studio
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full border border-[#d5c7b0] bg-[#f4efe6] px-5 py-2 text-sm font-black text-[#171411] shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition-transform duration-200 hover:scale-[1.03]"
              style={{ color: "#171411", backgroundColor: "#f4efe6", borderColor: "#d5c7b0" }}
            >
              Start free
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto flex max-w-7xl flex-col px-6 pb-24 pt-36 text-center md:px-8">
        <div className="mx-auto mb-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-secondary">
          <Sparkles className="h-3.5 w-3.5" />
          Creative workflow studio for image, video, and text work
        </div>

        <h1 className="mx-auto max-w-5xl text-5xl font-semibold leading-[1.02] tracking-[-0.08em] text-white md:text-7xl">
          Build multimodal AI workflows with the feel of a polished creative instrument.
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg font-light leading-8 text-secondary md:text-xl">
          Plan ideas, transform visuals, and run creative workflows in a workspace that feels fast, focused, and easy to return to.
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/workflows"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[#d5c7b0] bg-[#f4efe6] px-10 py-4 text-lg font-black text-[#171411] shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition-all duration-200 hover:scale-[1.03] sm:w-auto"
            style={{ color: "#171411", backgroundColor: "#f4efe6", borderColor: "#d5c7b0" }}
          >
            Open the studio
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="#how-it-works"
            className="flex w-full items-center justify-center rounded-full border border-white/10 bg-white/6 px-10 py-4 text-lg font-semibold text-white transition-all duration-200 hover:scale-[1.03] sm:w-auto"
          >
            See how it works
          </Link>
        </div>
      </section>

      <section id="nodes" className="mx-auto max-w-[1400px] px-6 pb-28 md:px-8">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-surface-container-low shadow-[0_40px_120px_rgba(0,0,0,0.4)]">
          <div className="grid min-h-[700px] grid-cols-1 bg-surface lg:grid-cols-[72px_1fr_360px]">
            <div className="hidden flex-col items-center gap-7 border-r border-white/8 bg-surface-container-lowest py-6 lg:flex">
              <PanelLeftClose className="h-5 w-5 text-secondary" />
              <WandSparkles className="h-5 w-5 text-white" />
              <Bot className="h-5 w-5 text-secondary" />
              <Sparkles className="mt-auto h-5 w-5 text-secondary" />
            </div>

            <div className="border-b border-white/8 lg:border-b-0 lg:border-r">
              <div className="flex h-14 items-center justify-between border-b border-white/8 px-6">
                <div className="flex items-center gap-6">
                  <span className="text-sm font-semibold tracking-tight text-white">Creative Workflow Studio</span>
                  <div className="h-4 w-px bg-white/12" />
                  <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary whitespace-nowrap">
                    <span className="text-white">Workflows</span>
                    <span>Templates</span>
                    <span>History</span>
                    <span>Guide</span>
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-semibold tracking-[0.22em] text-white">
                  READY
                </div>
              </div>

              <div className="relative flex min-h-[640px] items-end overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.06),_transparent_60%)]">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-50" />
                <div className="absolute left-6 top-6 z-10 flex items-center gap-2 rounded-xl border border-white/8 bg-[#191a1a]/80 px-4 py-2 shadow-2xl backdrop-blur-xl">
                  <div className="h-2 w-2 rounded-full bg-[#6dfe9c]" />
                  <div>
                    <p className="text-xs font-bold tracking-tight text-white">Homepage launch flow</p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">6 nodes active</p>
                  </div>
                  <div className="mx-2 h-5 w-px bg-white/8" />
                  <span className="text-stone-400">Run</span>
                  <span className="text-stone-400">Undo</span>
                  <span className="text-stone-400">Guide</span>
                </div>
                <div className="relative z-10 mx-6 mb-6 flex w-full items-end gap-4">
                  <div className="flex-1 rounded-[22px] border border-white/12 bg-white/8 p-5 backdrop-blur-xl">
                    <p className="text-sm font-light leading-7 text-white/92">
                      &ldquo;Pull a still from the campaign cut, refine the hero image, and write launch-ready copy for the homepage.&rdquo;
                    </p>
                  </div>
                  <div className="rounded-[20px] bg-white p-4 text-black shadow-lg">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 bg-surface p-6">
              <div>
                <p className="mb-4 text-[11px] font-black uppercase tracking-[0.24em] text-secondary">Quick Access</p>
                <div className="grid grid-cols-2 gap-4">
                  {quickAccess.map((item) => (
                    <div
                      key={item.label}
                      className="aspect-square rounded-2xl border border-white/8 bg-surface-container-high p-4 transition-colors hover:bg-surface-bright"
                    >
                      <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/6 text-white">
                        {item.icon}
                      </div>
                      <p className="text-xs font-semibold text-white">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-surface-container-high p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-secondary">Execution History</p>
                  <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                    12 runs
                  </span>
                </div>
                <div className="space-y-3">
                  {["Full Workflow", "2 nodes selected", "Single LLM node"].map((run, index) => (
                    <div key={run} className="rounded-2xl border border-white/8 bg-black/30 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{run}</span>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                            index === 2 ? "bg-red-500/16 text-red-200" : "bg-emerald-500/16 text-emerald-200"
                          }`}
                        >
                          {index === 2 ? "Failed" : "Success"}
                        </span>
                      </div>
                      <p className="text-xs leading-6 text-secondary">Inline node outputs, durations, and scopes mirror the studio run log.</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="overview" className="mx-auto grid max-w-7xl gap-6 px-6 pb-32 lg:grid-cols-3 md:px-8">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-[28px] border border-white/8 bg-surface-container-low p-10"
          >
            <p className="mb-5 text-[11px] font-black uppercase tracking-[0.24em] text-secondary">{feature.eyebrow}</p>
            <h2 className="mb-4 text-3xl font-semibold tracking-[-0.05em] text-white">{feature.title}</h2>
            <p className="max-w-lg text-sm leading-7 text-secondary">{feature.description}</p>
          </article>
        ))}
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-6 pb-32 md:px-8">
        <div className="rounded-[32px] border border-white/8 bg-surface-container-low p-8 md:p-10">
          <div className="max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-secondary">Minimal Flow</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-white">Get Started in Seconds</h2>
            <p className="mt-4 text-sm leading-7 text-secondary">
              Sign in first, then enter your workspace.
            </p>
            <p className="mt-2 text-sm leading-7 text-secondary">
              Once you&apos;re signed in, you&apos;ll be taken directly to your workflow studio where you can start working right away.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[24px] border border-white/8 bg-black/20 p-5">
              <p className="text-sm font-semibold text-white">1. Sign in</p>
              <p className="mt-2 text-sm leading-7 text-secondary">Create an account or log in to continue. It only takes a moment and gives you secure access to your workspace anytime.</p>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-black/20 p-5">
              <p className="text-sm font-semibold text-white">2. Enter your workspace</p>
              <p className="mt-2 text-sm leading-7 text-secondary">After signing in, you&apos;ll be taken straight to your personal workflow studio. Everything you need is organized and ready for you.</p>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-black/20 p-5">
              <p className="text-sm font-semibold text-white">3. Start working</p>
              <p className="mt-2 text-sm leading-7 text-secondary">Create new workflows, explore what&apos;s already there, or pick up where you left off. Your workspace is designed to keep everything in one place.</p>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-black/20 p-5">
              <p className="text-sm font-semibold text-white">4. Come back anytime</p>
              <p className="mt-2 text-sm leading-7 text-secondary">Your work is always saved, so you can return whenever you like and continue right where you stopped.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="cta" className="mx-auto max-w-7xl px-6 pb-28 md:px-8">
        <div className="flex flex-col items-start justify-between gap-8 rounded-[32px] bg-[#f4efe6] p-8 text-black md:flex-row md:items-center md:p-10">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-semibold tracking-[-0.06em]">Ready to get into the builder?</h2>
            <p className="mt-4 text-sm leading-7 text-black/70">
              Create your account and jump straight into your workspace.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-up" className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.02]">
              Create account
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8 px-6 py-10 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-semibold text-white">Deekshant Gupta</p>
            <p className="mt-1 text-sm text-secondary">Built with care for creative workflow design and execution.</p>
          </div>
          <div className="flex flex-col gap-2 text-sm md:items-end">
            <Link href="https://deekshant-g.netlify.app/" target="_blank" rel="noreferrer" className="text-secondary transition-colors hover:text-white">
              Portfolio
            </Link>
            <Link href="https://github.com/deekshant4758" target="_blank" rel="noreferrer" className="text-secondary transition-colors hover:text-white">
              GitHub
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
