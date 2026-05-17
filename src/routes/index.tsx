import { createFileRoute } from "@tanstack/react-router";
import { Brain, Target, LineChart, MessageSquare, Zap, ArrowRight, Check } from "lucide-react";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "mindflowAI — AI copilot for decisions, focus & goals" },
      { name: "description", content: "mindflowAI is an AI-powered productivity system that helps you stay organized, make sharper decisions, and hit your goals." },
    ],
  }),
});

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <nav className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          <div className="size-5 bg-aurora rounded-sm" />
          <span className="font-display text-sm font-bold tracking-tight">mindflowAI</span>
        </a>
        <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#how" className="hover:text-foreground transition-colors">Process</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
            Log in
          </a>
          <a href="/signup" className="bg-foreground text-background text-sm font-medium px-4 py-2 rounded-md hover:opacity-85 transition-opacity">
            Get started
          </a>
        </div>
      </nav>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section id="top" className="relative pt-14 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-accent/[0.07] blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 xl:gap-16 items-center">

          {/* Left: text */}
          <div>
            <div className="inline-flex items-center gap-2 border border-accent/30 bg-accent/5 text-accent text-xs font-medium px-3.5 py-1.5 rounded-full mb-8">
              <Zap className="size-3" />
              AI chat powered by Gemini
            </div>

            <h1 className="font-display font-bold tracking-tighter leading-[0.9] text-[clamp(2.8rem,6vw,5rem)] mb-6">
              Think clearer,<br />
              <span className="text-gradient">move faster.</span>
            </h1>

            <p className="text-muted-foreground text-lg leading-relaxed max-w-md mb-10">
              Your AI copilot for decisions, focus, and goal achievement.
              One command center that cuts through the noise.
            </p>

            <div className="flex items-center gap-3 mb-10">
              <a href="/signup" className="inline-flex items-center gap-2 bg-foreground text-background text-sm font-semibold px-6 py-3 rounded-md hover:opacity-85 transition-opacity">
                Start for free <ArrowRight className="size-4" />
              </a>
              <a href="/login" className="inline-flex items-center gap-2 border border-border text-sm font-medium px-6 py-3 rounded-md text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                Log in
              </a>
            </div>

            <div className="flex items-center gap-1.5">
              {[0,1,2,3,4].map(i => (
                <svg key={i} className="size-4 fill-accent" viewBox="0 0 12 12">
                  <path d="M6 0l1.5 4H12L8.5 6.5 10 11 6 8.5 2 11l1.5-4.5L0 4h4.5z"/>
                </svg>
              ))}
              <span className="text-sm text-muted-foreground ml-2">
                <strong className="text-foreground">4.9</strong> &nbsp;·&nbsp; 12,400+ users
              </span>
            </div>
          </div>

          {/* Right: app mockup */}
          <div className="relative">
          {/* Glow behind mockup */}
          <div className="absolute -inset-4 bg-accent/5 blur-2xl rounded-3xl" />
          <div className="relative border border-border bg-card rounded-xl overflow-hidden shadow-2xl">
            {/* Window bar */}
            <div className="border-b border-border bg-background/60 px-4 h-10 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="size-3 rounded-full bg-border" />
                <div className="size-3 rounded-full bg-border" />
                <div className="size-3 rounded-full bg-border" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="border border-border/60 rounded px-3 py-0.5 text-[11px] text-muted-foreground bg-background/40">
                  mindflowai.app/dashboard
                </div>
              </div>
            </div>

            {/* Dashboard layout */}
            <div className="flex h-[420px]">
              {/* Sidebar */}
              <div className="w-44 border-r border-border bg-background/40 p-3 flex flex-col gap-0.5 flex-shrink-0">
                <div className="flex items-center gap-2 px-2 py-2 mb-3">
                  <div className="size-3.5 bg-aurora rounded-sm" />
                  <span className="text-[11px] font-semibold">mindflowAI</span>
                </div>
                {[
                  { label: "Overview", active: true },
                  { label: "Goals", active: false },
                  { label: "Focus", active: false },
                  { label: "Decisions", active: false },
                  { label: "AI Chat", active: false },
                ].map((item) => (
                  <div key={item.label} className={`text-[11px] px-3 py-2 rounded-md ${item.active ? "bg-foreground/[0.08] text-foreground font-medium" : "text-muted-foreground"}`}>
                    {item.label}
                  </div>
                ))}
              </div>

              {/* Main */}
              <div className="flex-1 p-5 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Good morning</p>
                    <p className="font-semibold text-sm">Daily Overview · May 16</p>
                  </div>
                  <div className="text-xs text-muted-foreground">Tue, May 16 2026</div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: "Tasks", value: "8/12", note: "+2 today" },
                    { label: "Focus sessions", value: "3", note: "75 min" },
                    { label: "Streak", value: "27d", note: "personal best" },
                  ].map((s) => (
                    <div key={s.label} className="border border-border rounded-lg p-3 bg-background/30">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{s.label}</p>
                      <p className="text-xl font-bold">{s.value}</p>
                      <p className="text-[10px] text-accent mt-0.5">{s.note}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Tasks */}
                  <div className="border border-border rounded-lg p-3 bg-background/30">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Priority queue</p>
                    <div className="space-y-2">
                      {[
                        { t: "Review Q2 proposal", done: true },
                        { t: "Sync with design team", done: false },
                        { t: "Finalize budget draft", done: false },
                      ].map((task) => (
                        <div key={task.t} className="flex items-center gap-2">
                          <div className={`size-1.5 rounded-full flex-shrink-0 ${task.done ? "bg-accent" : "border border-border"}`} />
                          <span className={`text-[11px] ${task.done ? "line-through text-muted-foreground" : ""}`}>{task.t}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI panel */}
                  <div className="border border-accent/25 rounded-lg p-3 bg-accent/[0.04]">
                    <p className="text-[10px] uppercase tracking-wider text-accent mb-2">mindflowAI</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
                      You have 2 high-priority tasks open. "Sync with design team" is the best next step — start a 25-min session now.
                    </p>
                    <div className="flex items-end justify-between gap-2">
                      <div className="flex items-end gap-0.5 h-8 flex-1">
                        {[40,55,35,62,48,78,70,85,68,90,76,82].map((h, i) => (
                          <div key={i} className="flex-1 bg-gradient-to-t from-aurora-2 to-aurora-1 rounded-sm" style={{ height: `${h}%`, opacity: 0.3 + i * 0.06 }} />
                        ))}
                      </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-1">Focus sessions · 12 days</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>{/* end grid */}
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function Stats() {
  return (
    <div className="border-y border-border bg-card/30">
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-3 text-sm text-muted-foreground">
          {[
            { value: "12,400+", label: "active users" },
            { value: "4.9★", label: "average rating" },
            { value: "2 min", label: "setup time" },
            { value: "Free", label: "to get started" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{s.value}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function Features() {
  return (
    <section id="features" className="py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-3">Capabilities</p>
            <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">
              Everything in one place.
            </h2>
          </div>
          <p className="text-muted-foreground text-sm max-w-xs lg:text-right leading-relaxed">
            Built around how you actually work — not a rigid system you'll abandon in a week.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[180px_180px_180px] gap-3">

          {/* AI Decision Coach — hero card (2×2) */}
          <div className="md:col-span-2 lg:col-span-2 lg:row-span-2 min-h-[300px] lg:min-h-0 rounded-2xl border border-border bg-card/50 overflow-hidden p-6 flex flex-col hover:border-accent/30 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-5 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="size-3 text-accent" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">AI Decision Coach</span>
            </div>
            <p className="text-sm font-medium mb-4 max-w-sm">Context-aware coaching that untangles complex choices — powered by Gemini.</p>

            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              <div className="self-start bg-background/60 border border-border rounded-lg rounded-tl-none px-3 py-2 text-xs text-muted-foreground max-w-[80%]">
                What should I focus on right now?
              </div>
              <div className="self-end bg-accent/10 border border-accent/20 rounded-lg rounded-tr-none px-3 py-2 text-xs max-w-[85%] leading-relaxed">
                Start with <span className="text-accent font-medium">"Finalize Q2 proposal"</span> — highest priority, due Friday. Set a 25-min block now.
              </div>
              <div className="self-start bg-background/60 border border-border rounded-lg rounded-tl-none px-3 py-2 text-xs text-muted-foreground max-w-[80%]">
                What if I get stuck on it?
              </div>
              <div className="self-end bg-accent/10 border border-accent/20 rounded-lg rounded-tr-none px-3 py-2 text-xs max-w-[85%] leading-relaxed">
                Spend the first 5 min listing blockers only. Writing the blockers <em>is</em> the work. Go.
              </div>
            </div>

            <div className="mt-3 border border-border rounded-lg px-3 py-2 flex items-center gap-2 bg-background/40">
              <span className="text-xs text-muted-foreground flex-1">Ask anything...</span>
              <div className="size-5 rounded bg-foreground/[0.08] flex items-center justify-center">
                <ArrowRight className="size-3 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Focus Engine — tall (1×2) */}
          <div className="lg:row-span-2 min-h-[260px] lg:min-h-0 rounded-2xl border border-border bg-card/50 overflow-hidden p-5 flex flex-col hover:border-accent/30 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="size-5 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                <Brain className="size-3 text-accent" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Focus Engine</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Deep-work sessions that survive tab switches and browser throttling.</p>

            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="relative size-24">
                <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="5" className="text-border" />
                  <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="5"
                    strokeLinecap="round" className="text-accent"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    strokeDashoffset={`${2 * Math.PI * 44 * 0.32}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-xl font-bold tabular-nums">17:04</span>
                  <span className="text-[9px] text-muted-foreground">remaining</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                {["15m", "25m", "45m", "60m"].map((d) => (
                  <div key={d} className={`text-[10px] px-2 py-1 rounded-md border ${d === "25m" ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted-foreground"}`}>{d}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Goal Tracker */}
          <div className="rounded-2xl border border-border bg-card/50 overflow-hidden p-5 hover:border-accent/30 transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <div className="size-5 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                <Target className="size-3 text-accent" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Goal Tracker</span>
            </div>
            <div className="space-y-3">
              {[{ t: "Launch v2", p: 68 }, { t: "Read 20 books", p: 40 }, { t: "Inbox zero streak", p: 85 }].map((g) => (
                <div key={g.t}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">{g.t}</span>
                    <span className="text-accent font-medium">{g.p}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-border overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-aurora-2 to-aurora-1 rounded-full" style={{ width: `${g.p}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress Insights */}
          <div className="rounded-2xl border border-border bg-card/50 overflow-hidden p-5 hover:border-accent/30 transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <div className="size-5 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                <LineChart className="size-3 text-accent" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Insights</span>
            </div>
            <div className="flex items-end gap-0.5 h-14">
              {[30, 50, 40, 70, 55, 80, 65, 90, 75, 85, 70, 95].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-sm bg-gradient-to-t from-aurora-2 to-aurora-1"
                  style={{ height: `${h}%`, opacity: 0.35 + i * 0.053 }} />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Focus sessions · last 12 days</p>
          </div>

          {/* Quick Setup */}
          <div className="rounded-2xl border border-border bg-card/50 overflow-hidden p-5 hover:border-accent/30 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="size-5 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="size-3 text-accent" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Quick Setup</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">4 questions. 2 minutes. Your personalised command center, ready to go.</p>
            </div>
            <div className="mt-4 flex items-center gap-1.5">
              {["Role", "Goals", "Challenge", "Style"].map((s) => (
                <span key={s} className="text-[10px] border border-border rounded px-2 py-1 text-muted-foreground">{s}</span>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// ─── Process ──────────────────────────────────────────────────────────────────

function Process() {
  const steps = [
    { n: "01", title: "Set up in 2 minutes", desc: "Tell mindflowAI your role, goals, and biggest challenge. It builds your personalised command center instantly." },
    { n: "02", title: "Get daily guidance", desc: "AI coaching, focus blocks, and priority nudges that adapt to your real schedule — not a rigid system." },
    { n: "03", title: "Compound progress", desc: "Track sessions, log decisions, hit goals. Every week builds on the last and the AI keeps you honest." },
  ];

  return (
    <section id="how" className="py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm text-accent font-medium mb-3">How it works</p>
          <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">
            Simple to start, powerful to keep
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.n} className="relative">
              <div className="text-5xl font-display font-bold text-foreground/[0.06] mb-4 select-none">{s.n}</div>
              <h3 className="font-semibold text-base mb-3">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  const freePlan = [
    "Tasks, goals & decision log",
    "Focus timer (15–60 min)",
    "AI chat powered by Gemini",
    "Daily overview dashboard",
    "Onboarding profile & insights",
  ];
  const proPlan = [
    "Everything in Free",
    "Unlimited AI conversations",
    "Advanced analytics",
    "Cross-device sync",
    "Priority feature access",
  ];

  return (
    <section id="pricing" className="py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm text-accent font-medium mb-3">Pricing</p>
          <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Start free, upgrade when you're ready
          </h2>
          <p className="text-muted-foreground text-base max-w-md mx-auto">
            No credit card required to get started.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free */}
          <div className="border border-border rounded-2xl p-8 bg-card/40">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Free forever</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="font-display text-5xl font-bold">$0</span>
            </div>
            <p className="text-sm text-muted-foreground mb-8">No card required</p>
            <ul className="space-y-3 mb-8">
              {freePlan.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <Check className="size-4 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <a href="/signup" className="block text-center border border-border text-sm font-medium py-3 rounded-lg hover:bg-surface-hover hover:border-foreground/30 transition-colors">
              Get started free
            </a>
          </div>

          {/* Pro */}
          <div className="border border-accent/40 rounded-2xl p-8 bg-accent/[0.04] relative">
            <div className="absolute top-5 right-5 text-[10px] font-semibold uppercase tracking-widest border border-accent/40 text-accent px-2.5 py-1 rounded-full">
              Coming soon
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Pro</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="font-display text-5xl font-bold">$9</span>
              <span className="text-muted-foreground text-sm">/mo</span>
            </div>
            <p className="text-sm text-muted-foreground mb-8">14-day free trial · cancel anytime</p>
            <ul className="space-y-3 mb-8">
              {proPlan.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <Check className="size-4 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <div className="block text-center border border-border text-sm font-medium py-3 rounded-lg text-muted-foreground opacity-50 cursor-not-allowed">
              Start free trial
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section className="py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-[1fr_300px] gap-12 lg:gap-20 items-center">

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-6">Start free today</p>
            <h2 className="font-display font-bold tracking-tighter leading-[0.9] text-[clamp(2.4rem,5vw,4rem)] mb-8">
              One system.<br />
              Clearer thinking.<br />
              <span className="text-gradient">Real progress.</span>
            </h2>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
              {["12,400+ active users", "Free forever", "2 min setup", "No card required"].map((t) => (
                <span key={t} className="flex items-center gap-2">
                  <span className="size-1 rounded-full bg-accent inline-block flex-shrink-0" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <a href="/signup" className="flex items-center justify-center gap-2 bg-foreground text-background text-sm font-semibold px-6 py-3.5 rounded-xl hover:opacity-85 transition-opacity">
              Create free account <ArrowRight className="size-4" />
            </a>
            <a href="/login" className="flex items-center justify-center gap-2 border border-border text-sm font-medium px-6 py-3.5 rounded-xl text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
              Sign in
            </a>
            <p className="text-xs text-muted-foreground text-center mt-1">No credit card · Cancel anytime</p>
          </div>

        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="size-4 bg-aurora rounded-sm" />
          <span className="font-display text-foreground font-bold tracking-tight">mindflowAI</span>
          <span className="ml-2">© 2026</span>
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
          <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          <a href="#" className="hover:text-foreground transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function Landing() {
  return (
    <main>
      <Nav />
      <Hero />
      <Stats />
      <Features />
      <Process />
      <Pricing />
      <CTA />
      <Footer />
    </main>
  );
}
