import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUser, signOut, type User } from "@/lib/auth";
import { ThemeToggle } from "@/lib/theme";
import { generateWelcomeMessage, type ChatMessage, type DashboardContext } from "@/lib/ai-engine";
import { geminiChat, type AppAction } from "@/lib/gemini";
import {
  LayoutGrid, Target, Brain, MessageSquare, LogOut, Plus, Check, ChevronRight,
  ChevronLeft, Zap, X, Bot, ArrowUp, ArrowUpRight,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — mindflowAI" }] }),
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "goals" | "focus" | "decisions" | "onboarding" | "ai";

interface Task {
  id: number;
  text: string;
  priority: "High" | "Med" | "Low";
  done: boolean;
}

interface Goal {
  id: number;
  title: string;
  progress: number;
  target: string;
  done: boolean;
}

interface Decision {
  id: number;
  situation: string;
  choice: string;
  reason: string;
  createdAt: string;
}

interface FocusDay {
  date: string;
  sessions: number;
}

interface OnboardingAnswers {
  role: string;
  focus: string;
  challenge: string;
  monthGoal: string;
}

interface OnboardingData {
  completed: boolean;
  answers: Partial<OnboardingAnswers>;
  firstSeenAt?: string;
  completedAt?: string;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function load<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch { return fallback; }
}

function save<T>(key: string, v: T): void {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function recordFocusSession(days: FocusDay[]): FocusDay[] {
  const today = todayKey();
  const next = [...days];
  const idx = next.findIndex((d) => d.date === today);
  if (idx >= 0) next[idx] = { ...next[idx], sessions: next[idx].sessions + 1 };
  else next.push({ date: today, sessions: 1 });
  return next.slice(-12);
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function greeting(name: string): string {
  const h = new Date().getHours();
  const first = name.split(" ")[0];
  if (h < 12) return `Good morning, ${first}`;
  if (h < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

function dateStr(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtTime(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const FOCUS_SECS = 25 * 60;
const BREAK_SECS = 5 * 60;

// ─── Markdown component maps ──────────────────────────────────────────────────

const MD_COMPONENTS_BASE = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-4 space-y-0.5 mb-2">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-4 space-y-0.5 mb-2">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic opacity-80">{children}</em>,
  code: ({ children }: { children?: React.ReactNode }) => <code className="bg-surface-active px-1 font-mono text-accent text-[0.9em]">{children}</code>,
  h1: ({ children }: { children?: React.ReactNode }) => <p className="font-semibold mb-1">{children}</p>,
  h2: ({ children }: { children?: React.ReactNode }) => <p className="font-semibold mb-1">{children}</p>,
  h3: ({ children }: { children?: React.ReactNode }) => <p className="font-medium mb-1">{children}</p>,
};

const MD_COMPONENTS_SM = {
  ...MD_COMPONENTS_BASE,
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-3.5 space-y-0.5 mb-1.5">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-3.5 space-y-0.5 mb-1.5">{children}</ol>,
};

// ─── Onboarding config ────────────────────────────────────────────────────────

const OB_STEPS: Array<{
  id: keyof OnboardingAnswers;
  question: string;
  hint: string;
  options?: string[];
  type: "chip" | "text";
  placeholder?: string;
}> = [
  {
    id: "role",
    question: "What best describes you?",
    hint: "Helps us tailor your experience.",
    type: "chip",
    options: ["Student", "Professional", "Entrepreneur", "Creator", "Researcher", "Other"],
  },
  {
    id: "focus",
    question: "What's your main reason for using mindflowAI?",
    hint: "You can always change this later.",
    type: "chip",
    options: ["Getting organized", "Better decisions", "Deeper focus", "Hitting my goals", "All of the above"],
  },
  {
    id: "challenge",
    question: "What holds you back most?",
    hint: "Be honest — this is just for you.",
    type: "chip",
    options: ["Procrastination", "Too many priorities", "Decision fatigue", "Staying focused", "Losing momentum"],
  },
  {
    id: "monthGoal",
    question: "What's your #1 goal this month?",
    hint: "A single, specific goal works best.",
    type: "text",
    placeholder: "e.g. Launch my side project, Read 4 books, Lose 5kg…",
  },
];

const RESULT_LABELS: Record<keyof OnboardingAnswers, string> = {
  role: "You are",
  focus: "Your focus",
  challenge: "What holds you back",
  monthGoal: "This month's goal",
};

const TONES: { id: string; label: string; desc: string }[] = [
  { id: "direct",  label: "Direct",  desc: "No-fluff coaching. Short, punchy, actionable." },
  { id: "gentle",  label: "Gentle",  desc: "Warm and patient. Encouraging over demanding." },
  { id: "hype",    label: "Hype",    desc: "Your personal hype machine. Maximum motivation." },
  { id: "strict",  label: "Strict",  desc: "Tough love. High standards, no excuses." },
  { id: "chill",   label: "Chill",   desc: "Casual friend mode. Low pressure, high trust." },
];

const NAV: { id: Tab; label: string; Icon: typeof LayoutGrid }[] = [
  { id: "overview", label: "Overview", Icon: LayoutGrid },
  { id: "goals", label: "Goals", Icon: Target },
  { id: "focus", label: "Focus", Icon: Brain },
  { id: "decisions", label: "Decisions", Icon: MessageSquare },
  { id: "ai", label: "AI Chat", Icon: Bot },
  { id: "onboarding", label: "Setup", Icon: Zap },
];

// ─── Root ─────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [focusDays, setFocusDays] = useState<FocusDay[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingData>({ completed: false, answers: {} });
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [pendingTimerStart, setPendingTimerStart] = useState<{ minutes: number; label: string } | null>(null);
  const [tone, setTone] = useState("direct");

  useEffect(() => {
    (async () => {
      const u = getUser();
      if (!u) { navigate({ to: "/login" }); return; }
      setUser(u);

      const savedTone = localStorage.getItem(`mf_${u.email}_tone`);
      if (savedTone) setTone(savedTone);

      const snap = await getDoc(doc(db, "users", u.email));
      const data = snap.exists() ? snap.data() : {};

      const loadedTasks = (data.tasks ?? []) as Task[];
      const loadedGoals = (data.goals ?? []) as Goal[];
      const loadedDecisions = (data.decisions ?? []) as Decision[];
      const loadedFocusDays = (data.focusDays ?? []) as FocusDay[];

      setTasks(loadedTasks);
      setGoals(loadedGoals);
      setDecisions(loadedDecisions);
      setFocusDays(loadedFocusDays);

      const rawOb = data.onboarding as OnboardingData | undefined;
      const isFirstLoad = rawOb === undefined;
      const loadedOb: OnboardingData = rawOb ?? { completed: false, answers: {}, firstSeenAt: new Date().toISOString() };
      if (isFirstLoad) {
        setShowOnboardingModal(true);
        setDoc(doc(db, "users", u.email), { onboarding: loadedOb }, { merge: true });
      }
      setOnboarding(loadedOb);

      const todaySess = loadedFocusDays.find((d) => d.date === todayKey())?.sessions ?? 0;
      const savedMessages = (data.chatMessages ?? []) as ChatMessage[];
      if (savedMessages.length === 0) {
        const welcome: ChatMessage = {
          id: Date.now(),
          role: "assistant",
          content: generateWelcomeMessage({
            user: u,
            tasks: loadedTasks,
            goals: loadedGoals,
            decisions: loadedDecisions,
            todaySessions: todaySess,
            onboarding: loadedOb,
          }),
          ts: new Date().toISOString(),
        };
        setMessages([welcome]);
        setDoc(doc(db, "users", u.email), { chatMessages: [welcome] }, { merge: true });
      } else {
        setMessages(savedMessages);
      }
    })();
  }, [navigate]);

  const fb = (field: string, value: unknown) => {
    if (user) setDoc(doc(db, "users", user.email), { [field]: value }, { merge: true });
  };

  const updateTasks = (next: Task[]) => { setTasks(next); fb("tasks", next); };
  const updateGoals = (next: Goal[]) => { setGoals(next); fb("goals", next); };
  const updateDecisions = (next: Decision[]) => { setDecisions(next); fb("decisions", next); };
  const onSessionDone = () => {
    setFocusDays((prev) => {
      const next = recordFocusSession(prev);
      fb("focusDays", next);
      return next;
    });
  };

  const updateOnboarding = (next: OnboardingData) => { setOnboarding(next); fb("onboarding", next); };
  const handleOnboardingDismiss = () => setShowOnboardingModal(false);
  const handleOnboardingComplete = (answers: Partial<OnboardingAnswers>) => {
    updateOnboarding({ ...onboarding, completed: true, answers, completedAt: new Date().toISOString() });
    setShowOnboardingModal(false);
  };
  const handleOnboardingReset = () => updateOnboarding({ completed: false, answers: {}, firstSeenAt: onboarding.firstSeenAt });

  const executeActions = (actions: AppAction[]) => {
    const newTasks: Task[] = [];
    const newGoals: Goal[] = [];

    for (const action of actions) {
      if (action.name === "navigate") {
        setTab(action.args.tab as Tab);
      } else if (action.name === "start_timer") {
        const minutes = Number(action.args.minutes) || 25;
        const label = (action.args.label as string | undefined) ?? "";
        setPendingTimerStart({ minutes, label });
        setTab("focus");
      } else if (action.name === "add_task") {
        newTasks.push({
          id: Date.now() + newTasks.length,
          text: action.args.text as string,
          priority: (action.args.priority as Task["priority"]) ?? "Med",
          done: false,
        });
      } else if (action.name === "add_tasks") {
        const list = (action.args.tasks ?? []) as Array<{ text: string; priority: Task["priority"] }>;
        list.forEach((t, i) => newTasks.push({
          id: Date.now() + newTasks.length + i,
          text: t.text,
          priority: t.priority ?? "Med",
          done: false,
        }));
      } else if (action.name === "add_goal") {
        newGoals.push({
          id: Date.now() + newGoals.length,
          title: action.args.title as string,
          progress: 0,
          target: action.args.target as string,
          done: false,
        });
      }
    }

    // Batch into single updater calls to avoid stale-closure overwrites
    if (newTasks.length > 0) updateTasks([...tasks, ...newTasks]);
    if (newGoals.length > 0) updateGoals([...goals, ...newGoals]);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isGenerating || !user) return;
    const userMsg: ChatMessage = { id: Date.now(), role: "user", content: text.trim(), ts: new Date().toISOString() };
    const next = [...messages, userMsg];
    setMessages(next);
    fb("chatMessages", next);
    setIsGenerating(true);

    const ctx: DashboardContext = {
      user,
      tasks,
      goals,
      decisions,
      todaySessions: focusDays.find((d) => d.date === todayKey())?.sessions ?? 0,
      onboarding,
      tone,
    };

    try {
      const { text, actions } = await geminiChat({ data: JSON.stringify({ messages: next, context: ctx }) });
      const aiMsg: ChatMessage = { id: Date.now() + 1, role: "assistant", content: text, ts: new Date().toISOString() };
      const final = [...next, aiMsg];
      setMessages(final);
      fb("chatMessages", final);
      executeActions(actions);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota");
      const errMsg: ChatMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: isQuota
          ? "You've run out of free AI messages for today (Gemini's daily limit). Come back tomorrow for more — in the meantime, your Tasks, Goals, Focus timer, and Decision log all work without AI."
          : "Something went wrong reaching the AI. Check your connection and try again.",
        ts: new Date().toISOString(),
      };
      const final = [...next, errMsg];
      setMessages(final);
      fb("chatMessages", final);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearChat = () => { setMessages([]); fb("chatMessages", []); };

  const handleSignOut = () => { signOut(); navigate({ to: "/" }); };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="size-4 bg-aurora animate-pulse-glow" />
      </div>
    );
  }

  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const todaySessions = focusDays.find((d) => d.date === todayKey())?.sessions ?? 0;

  return (
    <div className="h-screen bg-background flex flex-col text-foreground overflow-hidden">
      {showOnboardingModal && (
        <OnboardingModal
          answers={onboarding.answers}
          onDismiss={handleOnboardingDismiss}
          onComplete={handleOnboardingComplete}
          onAnswersChange={(answers) => updateOnboarding({ ...onboarding, answers })}
        />
      )}

      {/* Top bar */}
      <header className="border-b border-border h-11 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="size-[15px] bg-aurora" />
            <span className="font-display text-sm font-semibold tracking-tight">mindflowAI</span>
          </div>
          <span className="text-border text-xs">|</span>
          <span className="text-xs text-muted-foreground capitalize">
            {tab === "onboarding" ? "setup" : tab === "ai" ? "AI chat" : tab}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground hidden sm:block">{user.email}</span>
          <div className="size-6 border border-border flex items-center justify-center text-[10px] font-semibold">
            {initials}
          </div>
          <ThemeToggle />
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="size-3" /> Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-44 border-r border-border flex-shrink-0 flex flex-col">
          <nav className="flex flex-col gap-px p-2 flex-1 pt-3">
            {NAV.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${
                  tab === id
                    ? "bg-surface-active text-foreground border-l border-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                <Icon className="size-3.5 flex-shrink-0" />
                {label}
                {id === "onboarding" && !onboarding.completed && (
                  <span className="ml-auto size-1.5 bg-accent flex-shrink-0" />
                )}
              </button>
            ))}
          </nav>
          <div className="border-t border-border p-3">
            <div className="text-[10px] text-muted-foreground truncate px-1 mb-2 font-medium">{user.name}</div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-1 py-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="size-3" /> Sign out
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {tab === "overview" && (
            <Overview
              user={user}
              tasks={tasks}
              onTaskChange={updateTasks}
              decisionsCount={decisions.length}
              todaySessions={todaySessions}
              focusDays={focusDays}
              messages={messages}
              isGenerating={isGenerating}
              onSendMessage={handleSendMessage}
              sidebarExpanded={sidebarExpanded}
              onToggleSidebar={() => setSidebarExpanded((e) => !e)}
              onNavigateToAI={() => setTab("ai")}
            />
          )}
          {tab === "goals" && <Goals goals={goals} onGoalsChange={updateGoals} />}
          {tab === "focus" && (
            <Focus
              onSessionDone={onSessionDone}
              todaySessions={todaySessions}
              pendingTimerStart={pendingTimerStart}
              onTimerStarted={() => setPendingTimerStart(null)}
            />
          )}
          {tab === "decisions" && <Decisions decisions={decisions} onDecisionsChange={updateDecisions} />}
          {tab === "ai" && (
            <AIChat
              messages={messages}
              isGenerating={isGenerating}
              onSendMessage={handleSendMessage}
              onClearChat={handleClearChat}
              tasks={tasks}
              goals={goals}
              decisions={decisions}
              todaySessions={todaySessions}
              onboarding={onboarding}
              tone={tone}
              onToneChange={(t) => {
                setTone(t);
                if (user) localStorage.setItem(`mf_${user.email}_tone`, t);
              }}
            />
          )}
          {tab === "onboarding" && (
            <OnboardingPanel
              onboarding={onboarding}
              onComplete={handleOnboardingComplete}
              onReset={handleOnboardingReset}
              onAnswersChange={(answers) => updateOnboarding({ ...onboarding, answers })}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function Overview({
  user, tasks, onTaskChange, decisionsCount, todaySessions, focusDays,
  messages, isGenerating, onSendMessage, sidebarExpanded, onToggleSidebar, onNavigateToAI,
}: {
  user: User;
  tasks: Task[];
  onTaskChange: (t: Task[]) => void;
  decisionsCount: number;
  todaySessions: number;
  focusDays: FocusDay[];
  messages: ChatMessage[];
  isGenerating: boolean;
  onSendMessage: (text: string) => void;
  sidebarExpanded: boolean;
  onToggleSidebar: () => void;
  onNavigateToAI: () => void;
}) {
  const [newTask, setNewTask] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("Med");

  const done = tasks.filter((t) => t.done).length;
  const undone = tasks.filter((t) => !t.done).length;

  const toggleTask = (id: number) =>
    onTaskChange(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const removeTask = (id: number) =>
    onTaskChange(tasks.filter((t) => t.id !== id));

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    onTaskChange([...tasks, { id: Date.now(), text: newTask.trim(), priority, done: false }]);
    setNewTask("");
  };

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (11 - i));
    const key = d.toISOString().split("T")[0];
    return focusDays.find((fd) => fd.date === key)?.sessions ?? 0;
  });
  const maxSessions = Math.max(...chartData, 1);
  const hasChartData = chartData.some((v) => v > 0);

  const metrics = [
    {
      label: "Tasks done",
      value: tasks.length === 0 ? "—" : `${done} / ${tasks.length}`,
      sub: tasks.length === 0 ? "Add your first task" : undone === 0 ? "All complete ↑" : `${undone} remaining`,
    },
    {
      label: "Focus sessions",
      value: todaySessions === 0 ? "—" : String(todaySessions),
      sub: todaySessions === 0 ? "Start your first session" : "today",
    },
    {
      label: "Decisions logged",
      value: decisionsCount === 0 ? "—" : String(decisionsCount),
      sub: decisionsCount === 0 ? "Log your first decision" : "total",
    },
  ];

  const sidebarWidth = sidebarExpanded ? 400 : 264;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Greeting */}
      <div className="px-6 lg:px-8 py-5 border-b border-border flex-shrink-0">
        <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">{dateStr()}</p>
        <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">{greeting(user.name)}</h1>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 border-b border-border flex-shrink-0">
        {metrics.map((m, i) => (
          <div key={m.label} className={`p-4 lg:p-5 ${i < 2 ? "border-r border-border" : ""}`}>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">{m.label}</div>
            <div className="text-xl lg:text-2xl font-semibold">{m.value}</div>
            <div className={`text-[10px] mt-1 ${m.value === "—" ? "text-muted-foreground" : "text-accent"}`}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Content grid — right column width is dynamic */}
      <div
        className="flex-1 overflow-hidden min-h-0 grid"
        style={{ gridTemplateColumns: `1fr ${sidebarWidth}px` }}
      >
        {/* Left: chart + tasks */}
        <div className="border-r border-border flex flex-col overflow-hidden">
          {/* Chart */}
          <div className="border-b border-border p-5 flex-shrink-0">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Focus sessions · last 12 days</div>
            {hasChartData ? (
              <>
                <div className="flex items-end gap-1 h-16">
                  {chartData.map((v, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-aurora-2 to-aurora-1 transition-all"
                      style={{ height: `${(v / maxSessions) * 100}%`, minHeight: v > 0 ? 2 : 0, opacity: 0.4 + (i / chartData.length) * 0.5 }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                  <span>11 days ago</span>
                  <span>Today</span>
                </div>
              </>
            ) : (
              <div className="h-16 flex items-center">
                <p className="text-[11px] text-muted-foreground">Complete focus sessions to see your chart</p>
              </div>
            )}
          </div>

          {/* Task list */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Priority queue</div>
              {tasks.length > 0 && <span className="text-[10px] text-muted-foreground">{undone} active</span>}
            </div>

            {tasks.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-4">No tasks yet. Add one below.</p>
            ) : (
              <div className="space-y-px">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 py-2.5 px-2 hover:bg-surface-hover transition-colors group"
                  >
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`size-3.5 flex-shrink-0 border flex items-center justify-center transition-colors ${
                        task.done ? "border-accent bg-accent/20" : "border-border group-hover:border-foreground/30"
                      }`}
                    >
                      {task.done && <Check className="size-2.5 text-accent" />}
                    </button>
                    <span className={`text-sm flex-1 ${task.done ? "line-through text-muted-foreground" : ""}`}>
                      {task.text}
                    </span>
                    <span
                      className={`text-[9px] tracking-widest uppercase px-1.5 py-0.5 border flex-shrink-0 ${
                        task.priority === "High"
                          ? "border-accent/30 text-accent"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {task.priority}
                    </span>
                    <button
                      onClick={() => removeTask(task.id)}
                      className="text-[10px] text-transparent group-hover:text-muted-foreground hover:!text-destructive transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={addTask} className="flex gap-2 mt-4 pt-4 border-t border-border">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Add a task…"
                className="flex-1 bg-transparent border border-border px-3 py-2 text-xs outline-none focus:border-accent/50 placeholder:text-muted-foreground/40 transition-colors"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Task["priority"])}
                className="bg-transparent border border-border px-2 py-2 text-[10px] text-muted-foreground outline-none hover:border-foreground/30 transition-colors"
              >
                <option value="High">High</option>
                <option value="Med">Med</option>
                <option value="Low">Low</option>
              </select>
              <button type="submit" className="border border-border px-3 py-2 hover:bg-surface-hover transition-colors">
                <Plus className="size-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Right: AI sidebar chat */}
        <SidebarChat
          messages={messages}
          isGenerating={isGenerating}
          onSend={onSendMessage}
          expanded={sidebarExpanded}
          onToggleExpand={onToggleSidebar}
          onOpenFull={onNavigateToAI}
        />
      </div>
    </div>
  );
}

// ─── Sidebar Chat ─────────────────────────────────────────────────────────────

function SidebarChat({
  messages, isGenerating, onSend, expanded, onToggleExpand, onOpenFull,
}: {
  messages: ChatMessage[];
  isGenerating: boolean;
  onSend: (text: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpenFull: () => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col overflow-hidden border-l border-border">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="size-1.5 bg-accent" />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">mindflowAI</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleExpand}
            title={expanded ? "Collapse" : "Expand"}
            className="size-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            {expanded ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
          </button>
          <button
            onClick={onOpenFull}
            title="Open full chat"
            className="size-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <ArrowUpRight className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.map((msg) => (
          <div key={msg.id} className={msg.role === "user" ? "flex justify-end" : ""}>
            {msg.role === "assistant" ? (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-accent mb-1.5">mindflowAI</p>
                <div className="text-xs text-foreground leading-relaxed">
                  <ReactMarkdown components={MD_COMPONENTS_SM}>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <p className="text-xs bg-surface-active border border-border px-3 py-2 text-foreground leading-relaxed max-w-[88%] text-left">
                {msg.content}
              </p>
            )}
          </div>
        ))}
        {isGenerating && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-accent mb-1.5">mindflowAI</p>
            <div className="flex gap-1.5 items-center h-4">
              <div className="size-1.5 bg-accent/60 animate-pulse" />
              <div className="size-1.5 bg-accent/60 animate-pulse [animation-delay:150ms]" />
              <div className="size-1.5 bg-accent/60 animate-pulse [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-border p-3 flex gap-2 flex-shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask mindflowAI…"
          disabled={isGenerating}
          className="flex-1 bg-transparent text-xs border border-border px-3 py-1.5 outline-none focus:border-accent/50 placeholder:text-muted-foreground/40 disabled:opacity-50 transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || isGenerating}
          className="border border-border px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-hover disabled:opacity-40 transition-colors"
        >
          <ArrowUp className="size-3.5" />
        </button>
      </form>
    </div>
  );
}

// ─── AI Chat (full tab) ───────────────────────────────────────────────────────

function AIChat({
  messages, isGenerating, onSendMessage, onClearChat,
  tasks, goals, decisions, todaySessions, onboarding, tone, onToneChange,
}: {
  messages: ChatMessage[];
  isGenerating: boolean;
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  tasks: Task[];
  goals: Goal[];
  decisions: Decision[];
  todaySessions: number;
  onboarding: OnboardingData;
  tone: string;
  onToneChange: (tone: string) => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const pending = tasks.filter((t) => !t.done);
  const activeGoals = goals.filter((g) => !g.done);
  const tipPrompt = onboarding.answers?.challenge
    ? `Give me a tip for ${onboarding.answers.challenge.toLowerCase()}`
    : "Give me a productivity tip";

  const suggested = [
    "What should I focus on right now?",
    "How am I doing today?",
    tipPrompt,
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-0.5">AI assistant</p>
            <h1 className="font-display text-xl font-bold tracking-tight">mindflowAI</h1>
          </div>
          <button
            onClick={onClearChat}
            className="text-[11px] text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 hover:bg-surface-hover transition-colors"
          >
            Clear chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 min-h-0">
          {messages.map((msg) => (
            <div key={msg.id} className={msg.role === "user" ? "flex justify-end" : ""}>
              {msg.role === "assistant" ? (
                <div className="max-w-[80%]">
                  <p className="text-[10px] uppercase tracking-widest text-accent mb-2">mindflowAI</p>
                  <div className="text-sm text-foreground leading-relaxed">
                    <ReactMarkdown components={MD_COMPONENTS_BASE}>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="max-w-[80%]">
                  <p className="text-sm bg-surface-active border border-border px-4 py-3 text-foreground leading-relaxed">
                    {msg.content}
                  </p>
                </div>
              )}
            </div>
          ))}
          {isGenerating && (
            <div className="max-w-[80%]">
              <p className="text-[10px] uppercase tracking-widest text-accent mb-2">mindflowAI</p>
              <div className="flex gap-2 items-center h-5">
                <div className="size-2 bg-accent/70 animate-pulse" />
                <div className="size-2 bg-accent/70 animate-pulse [animation-delay:150ms]" />
                <div className="size-2 bg-accent/70 animate-pulse [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="border-t border-border px-6 py-4 flex gap-3 flex-shrink-0">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about your tasks, goals, or focus…"
            disabled={isGenerating}
            className="flex-1 bg-transparent text-sm border border-border px-4 py-2.5 outline-none focus:border-accent/50 placeholder:text-muted-foreground/40 disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            className="bg-foreground text-background text-xs font-medium px-5 py-2.5 hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            Send
          </button>
        </form>
      </div>

      {/* Context panel */}
      <div className="w-64 flex-shrink-0 border-l border-border overflow-y-auto">
        <div className="p-5">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-4">Your context</div>
          <div className="divide-y divide-border">
            <div className="py-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Tasks</div>
              <div className="text-sm font-medium">{tasks.filter((t) => t.done).length} / {tasks.length} done</div>
              {pending.length > 0 && <div className="text-[11px] text-muted-foreground mt-0.5">{pending.length} pending</div>}
            </div>
            <div className="py-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Focus</div>
              <div className="text-sm font-medium">{todaySessions} session{todaySessions !== 1 ? "s" : ""}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">today</div>
            </div>
            <div className="py-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Goals</div>
              <div className="text-sm font-medium">{activeGoals.length} active</div>
              {onboarding.answers?.monthGoal && (
                <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{onboarding.answers.monthGoal}</div>
              )}
            </div>
            <div className="py-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Decisions</div>
              <div className="text-sm font-medium">{decisions.length} logged</div>
            </div>
            {onboarding.completed && (onboarding.answers?.role || onboarding.answers?.challenge) && (
              <div className="py-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Profile</div>
                {onboarding.answers?.role && <div className="text-[11px] text-muted-foreground">{onboarding.answers.role}</div>}
                {onboarding.answers?.challenge && (
                  <div className="text-[11px] text-muted-foreground mt-1">Challenge: {onboarding.answers.challenge}</div>
                )}
              </div>
            )}
          </div>

          {/* Tone picker */}
          <div className="mt-5 pt-5 border-t border-border">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">AI tone</div>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onToneChange(t.id)}
                  className={`text-[10px] px-2.5 py-1.5 border rounded transition-colors ${
                    tone === t.id
                      ? "border-accent bg-accent/10 text-accent font-medium"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              {TONES.find((t) => t.id === tone)?.desc}
            </p>
          </div>

          {/* Suggested prompts */}
          <div className="mt-5 pt-5 border-t border-border">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Try asking</div>
            <div className="space-y-1.5">
              {suggested.map((q) => (
                <button
                  key={q}
                  onClick={() => { onSendMessage(q); }}
                  disabled={isGenerating}
                  className="w-full text-left text-[11px] text-muted-foreground hover:text-foreground border border-border px-3 py-2 hover:bg-surface-hover transition-colors disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Goals ────────────────────────────────────────────────────────────────────

function Goals({ goals, onGoalsChange }: { goals: Goal[]; onGoalsChange: (g: Goal[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");

  const addGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onGoalsChange([...goals, { id: Date.now(), title: title.trim(), progress: 0, target: target.trim() || "Ongoing", done: false }]);
    setTitle("");
    setTarget("");
    setShowForm(false);
  };

  const updateProgress = (id: number, delta: number) =>
    onGoalsChange(goals.map((g) => g.id === id ? { ...g, progress: Math.max(0, Math.min(100, g.progress + delta)) } : g));

  const markDone = (id: number) =>
    onGoalsChange(goals.map((g) => g.id === id ? { ...g, progress: 100, done: !g.done } : g));

  const remove = (id: number) =>
    onGoalsChange(goals.filter((g) => g.id !== id));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 lg:px-8 py-5 border-b border-border flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">Progress tracking</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">Goals</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 border border-border text-xs px-3 py-2 hover:bg-surface-hover transition-colors"
        >
          <Plus className="size-3" /> New goal
        </button>
      </div>

      {showForm && (
        <form onSubmit={addGoal} className="border-b border-border px-6 lg:px-8 py-5 space-y-3 flex-shrink-0">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground block mb-1.5">Goal</label>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What do you want to achieve?"
                className="w-full bg-transparent border border-border px-3 py-2.5 text-sm outline-none focus:border-accent/50 placeholder:text-muted-foreground/30 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground block mb-1.5">Target / deadline</label>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Q3 2026, Dec 31, Ongoing…"
                className="w-full bg-transparent border border-border px-3 py-2.5 text-sm outline-none focus:border-accent/50 placeholder:text-muted-foreground/30 transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-foreground text-background text-xs px-4 py-2 hover:opacity-80 transition-opacity">
              Add goal
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto">
        {goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-[10px] tracking-widest uppercase text-muted-foreground mb-2">No goals yet</div>
            <p className="text-sm text-muted-foreground mb-4">Add a goal to start tracking your progress.</p>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 border border-border text-xs px-3 py-2 hover:bg-surface-hover transition-colors"
            >
              <Plus className="size-3" /> Add your first goal
            </button>
          </div>
        ) : (
          goals.map((goal) => (
            <div key={goal.id} className="border-b border-border px-6 lg:px-8 py-5 group">
              <div className="flex items-start justify-between gap-6 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-sm font-medium ${goal.done ? "line-through text-muted-foreground" : ""}`}>{goal.title}</span>
                    {goal.done && <span className="text-[9px] tracking-widest uppercase border border-accent/30 text-accent px-1.5 py-0.5 flex-shrink-0">Done</span>}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{goal.target}</span>
                </div>
                <span className="text-sm font-semibold text-muted-foreground flex-shrink-0">{goal.progress}%</span>
              </div>
              <div className="h-px bg-border mb-3">
                <div className="h-full bg-gradient-to-r from-aurora-1 to-aurora-3 transition-all duration-300" style={{ width: `${goal.progress}%` }} />
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => updateProgress(goal.id, -5)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">−5%</button>
                <button onClick={() => updateProgress(goal.id, 5)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">+5%</button>
                <button onClick={() => markDone(goal.id)} className="text-[10px] text-muted-foreground hover:text-accent transition-colors flex items-center gap-1">
                  <Check className="size-3" /> {goal.done ? "Unmark" : "Mark done"}
                </button>
                <button onClick={() => remove(goal.id)} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors ml-auto opacity-0 group-hover:opacity-100">
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Focus ────────────────────────────────────────────────────────────────────

interface SessionEntry {
  label: string;
  duration: number;
  ts: string;
}

interface FocusTimerState {
  endTime: number | null;
  secsLeft: number;
  onBreak: boolean;
  localSessions: number;
  focusDuration: number;
  sessionLabel: string;
  sessionLog: SessionEntry[];
}

const DURATION_OPTIONS = [
  { label: "15m", secs: 15 * 60 },
  { label: "25m", secs: 25 * 60 },
  { label: "45m", secs: 45 * 60 },
  { label: "60m", secs: 60 * 60 },
];

function Focus({
  onSessionDone,
  todaySessions,
  pendingTimerStart,
  onTimerStarted,
}: {
  onSessionDone: () => void;
  todaySessions: number;
  pendingTimerStart: { minutes: number; label: string } | null;
  onTimerStarted: () => void;
}) {
  const [focusDuration, setFocusDuration] = useState(FOCUS_SECS);
  const [secsLeft, setSecsLeft] = useState(FOCUS_SECS);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [onBreak, setOnBreak] = useState(false);
  const [localSessions, setLocalSessions] = useState(0);
  const [sessionLabel, setSessionLabel] = useState("");
  const [sessionLog, setSessionLog] = useState<SessionEntry[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSessionDoneRef = useRef(onSessionDone);
  onSessionDoneRef.current = onSessionDone;
  const sessionLabelRef = useRef(sessionLabel);
  sessionLabelRef.current = sessionLabel;
  const sessionLogRef = useRef(sessionLog);
  sessionLogRef.current = sessionLog;

  const running = endTime !== null;

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mf_focus_timer");
      if (saved) {
        const s = JSON.parse(saved) as FocusTimerState;
        setFocusDuration(s.focusDuration ?? FOCUS_SECS);
        setOnBreak(s.onBreak ?? false);
        setLocalSessions(s.localSessions ?? 0);
        setSessionLabel(s.sessionLabel ?? "");
        setSessionLog(s.sessionLog ?? []);
        if (s.endTime && s.endTime > Date.now()) {
          setEndTime(s.endTime);
          setSecsLeft(Math.round((s.endTime - Date.now()) / 1000));
        } else {
          setSecsLeft(s.secsLeft ?? s.focusDuration ?? FOCUS_SECS);
        }
      }
    } catch {}
  }, []);

  // AI-triggered timer start — read localStorage directly to avoid stale-closure race with mount restore
  useEffect(() => {
    if (!pendingTimerStart) return;
    try {
      const saved = JSON.parse(localStorage.getItem("mf_focus_timer") || "null") as FocusTimerState | null;
      if (saved?.endTime && saved.endTime > Date.now()) return; // active timer already running, don't override
    } catch {}
    const secs = Math.max(60, pendingTimerStart.minutes * 60);
    setFocusDuration(secs);
    setSecsLeft(secs);
    if (pendingTimerStart.label) setSessionLabel(pendingTimerStart.label);
    const end = Date.now() + secs * 1000;
    setEndTime(end);
    localStorage.setItem("mf_focus_timer", JSON.stringify({
      endTime: end, secsLeft: secs, onBreak: false,
      localSessions, focusDuration: secs,
      sessionLabel: pendingTimerStart.label, sessionLog,
    }));
    onTimerStarted();
  }, [pendingTimerStart]);

  useEffect(() => {
    if (ticker.current) clearInterval(ticker.current);
    if (endTime === null) return;

    ticker.current = setInterval(() => {
      const remaining = Math.round((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(ticker.current!);
        ticker.current = null;
        setSecsLeft(0);
        if (!onBreak) {
          const entry: SessionEntry = {
            label: sessionLabelRef.current || "Focus session",
            duration: Math.round(focusDuration / 60),
            ts: new Date().toISOString(),
          };
          const newLog = [...sessionLogRef.current, entry];
          const nextSessions = localSessions + 1;
          setSessionLog(newLog);
          setSessionLabel("");
          setLocalSessions(nextSessions);
          onSessionDoneRef.current();
          setOnBreak(true);
          const nextEnd = Date.now() + BREAK_SECS * 1000;
          setEndTime(nextEnd);
          setSecsLeft(BREAK_SECS);
          localStorage.setItem("mf_focus_timer", JSON.stringify({ endTime: nextEnd, secsLeft: BREAK_SECS, onBreak: true, localSessions: nextSessions, focusDuration, sessionLabel: "", sessionLog: newLog }));
        } else {
          setOnBreak(false);
          setEndTime(null);
          setSecsLeft(focusDuration);
          localStorage.setItem("mf_focus_timer", JSON.stringify({ endTime: null, secsLeft: focusDuration, onBreak: false, localSessions, focusDuration, sessionLabel: sessionLabelRef.current, sessionLog: sessionLogRef.current }));
        }
      } else {
        setSecsLeft(remaining);
        localStorage.setItem("mf_focus_timer", JSON.stringify({ endTime, secsLeft: remaining, onBreak, localSessions, focusDuration, sessionLabel: sessionLabelRef.current, sessionLog: sessionLogRef.current }));
      }
    }, 500);

    return () => { if (ticker.current) clearInterval(ticker.current); };
  }, [endTime, onBreak, localSessions, focusDuration]);

  const start = () => {
    const end = Date.now() + secsLeft * 1000;
    setEndTime(end);
    localStorage.setItem("mf_focus_timer", JSON.stringify({ endTime: end, secsLeft, onBreak, localSessions, focusDuration, sessionLabel, sessionLog }));
  };

  const pause = () => {
    setEndTime(null);
    localStorage.setItem("mf_focus_timer", JSON.stringify({ endTime: null, secsLeft, onBreak, localSessions, focusDuration, sessionLabel, sessionLog }));
  };

  const reset = () => {
    setEndTime(null);
    setOnBreak(false);
    setSecsLeft(focusDuration);
    setLocalSessions(0);
    setSessionLabel("");
    setSessionLog([]);
    setShowCustom(false);
    localStorage.removeItem("mf_focus_timer");
  };

  const skipBreak = () => {
    setEndTime(null);
    setOnBreak(false);
    setSecsLeft(focusDuration);
    localStorage.setItem("mf_focus_timer", JSON.stringify({ endTime: null, secsLeft: focusDuration, onBreak: false, localSessions, focusDuration, sessionLabel, sessionLog }));
  };

  const adjustTime = (deltaSecs: number) => {
    if (onBreak) return;
    const newSecs = Math.max(60, secsLeft + deltaSecs);
    const actualDelta = newSecs - secsLeft;
    const newDuration = Math.max(60, focusDuration + actualDelta);
    setSecsLeft(newSecs);
    setFocusDuration(newDuration);
    if (running) {
      const newEnd = Date.now() + newSecs * 1000;
      setEndTime(newEnd);
      localStorage.setItem("mf_focus_timer", JSON.stringify({ endTime: newEnd, secsLeft: newSecs, onBreak, localSessions, focusDuration: newDuration, sessionLabel, sessionLog }));
    }
  };

  const applyCustom = () => {
    const mins = parseInt(customInput, 10);
    if (!mins || mins < 1 || mins > 240) return;
    const secs = mins * 60;
    setFocusDuration(secs);
    setSecsLeft(secs);
    setShowCustom(false);
    setCustomInput("");
  };

  const selectPreset = (secs: number) => {
    if (running) return;
    setFocusDuration(secs);
    setSecsLeft(secs);
    setShowCustom(false);
    setCustomInput("");
  };

  const totalSecs = onBreak ? BREAK_SECS : focusDuration;
  const pct = Math.max(0, Math.min(1, 1 - secsLeft / totalSecs));
  const circumference = 2 * Math.PI * 88;
  const totalMinutesToday = sessionLog.reduce((acc, s) => acc + s.duration, 0);
  const totalSessionsToday = todaySessions + localSessions;

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-2 h-full overflow-hidden">

      {/* Left: timer */}
      <div className="border-b lg:border-b-0 lg:border-r border-border flex flex-col items-center justify-center p-8 lg:p-10 gap-0">

        <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-7 flex items-center gap-2.5">
          <span className={`size-1.5 rounded-full flex-shrink-0 ${running ? (onBreak ? "bg-muted-foreground" : "bg-accent animate-pulse") : "bg-border"}`} />
          {onBreak ? "Break" : "Focus"} · Session {localSessions + 1}
        </div>

        {/* Ring */}
        <div className="relative size-52 lg:size-60 flex items-center justify-center mb-6">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="88" fill="none" strokeWidth="4" className="stroke-border" />
            <circle
              cx="100" cy="100" r="88" fill="none" strokeWidth="4.5"
              strokeLinecap="round"
              className={`${onBreak ? "stroke-muted-foreground/40" : "stroke-accent"} transition-[stroke-dashoffset] duration-500`}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * pct}
            />
          </svg>
          <div className="text-center">
            <div className="font-display text-5xl lg:text-6xl font-bold tracking-tighter tabular-nums">
              {fmtTime(secsLeft)}
            </div>
            {running && sessionLabel && (
              <div className="text-[11px] text-muted-foreground mt-1.5 max-w-[130px] truncate px-2">{sessionLabel}</div>
            )}
          </div>
        </div>

        {/* Nudge buttons — while running a focus block */}
        {running && !onBreak && (
          <div className="flex items-center gap-1.5 mb-5">
            {([[-5, "−5m"], [-1, "−1m"], [1, "+1m"], [5, "+5m"]] as [number, string][]).map(([delta, label]) => (
              <button key={label} onClick={() => adjustTime(delta * 60)}
                className="text-[10px] border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 px-2.5 py-1.5 rounded transition-colors tabular-nums">
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Skip break */}
        {onBreak && (
          <button onClick={skipBreak}
            className="mb-5 text-xs border border-border text-muted-foreground hover:text-foreground px-5 py-2 rounded transition-colors">
            Skip break →
          </button>
        )}

        {/* Session label — when idle */}
        {!running && !onBreak && (
          <div className="w-full max-w-xs mb-5">
            <input
              type="text"
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
              placeholder="What are you working on?"
              maxLength={80}
              className="w-full bg-transparent border-b border-border text-sm text-center placeholder:text-muted-foreground/40 outline-none focus:border-accent/60 pb-1.5 transition-colors"
            />
          </div>
        )}

        {/* Duration presets + custom — when idle */}
        {!running && !onBreak && (
          <div className="flex flex-col items-center gap-2 mb-6">
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {DURATION_OPTIONS.map((opt) => (
                <button key={opt.secs} onClick={() => selectPreset(opt.secs)}
                  className={`text-[10px] tracking-widest uppercase px-3 py-1.5 border rounded transition-colors ${
                    focusDuration === opt.secs && !showCustom
                      ? "border-accent text-accent bg-accent/5"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}>
                  {opt.label}
                </button>
              ))}
              <button onClick={() => setShowCustom(!showCustom)}
                className={`text-[10px] tracking-widest uppercase px-3 py-1.5 border rounded transition-colors ${
                  showCustom ? "border-accent text-accent bg-accent/5" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                }`}>
                Custom
              </button>
            </div>
            {showCustom && (
              <div className="flex items-center gap-2">
                <input
                  type="number" value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyCustom()}
                  placeholder="min" min="1" max="240"
                  className="w-16 border border-border bg-transparent text-center text-sm py-1.5 px-2 rounded outline-none focus:border-accent/60 placeholder:text-muted-foreground/40"
                />
                <button onClick={applyCustom}
                  className="text-xs border border-border px-3 py-1.5 rounded hover:bg-surface-hover transition-colors">
                  Set
                </button>
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          {!running ? (
            <button onClick={start}
              className="bg-foreground text-background text-sm font-medium px-8 py-2.5 rounded hover:opacity-80 transition-opacity">
              {localSessions === 0 && secsLeft === focusDuration ? "Start" : secsLeft === focusDuration ? "New session" : "Resume"}
            </button>
          ) : (
            <button onClick={pause}
              className="border border-border text-sm px-8 py-2.5 rounded hover:bg-surface-hover transition-colors">
              Pause
            </button>
          )}
          <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2.5">
            Reset
          </button>
        </div>
      </div>

      {/* Right: session log */}
      <div className="flex flex-col p-8 lg:p-10 overflow-y-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">Today</div>
            <div className="font-display text-4xl font-bold">{totalSessionsToday}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {totalSessionsToday === 1 ? "session" : "sessions"}
              {totalMinutesToday > 0 && ` · ${totalMinutesToday} min`}
            </div>
          </div>
          {sessionLog.length > 0 && (
            <button
              onClick={() => { setSessionLog([]); setLocalSessions(0); localStorage.removeItem("mf_focus_timer"); }}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              Clear log
            </button>
          )}
        </div>

        {sessionLog.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-2 leading-relaxed max-w-xs">
              Name what you're working on, set a duration, and start. Each completed session gets logged here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {[...sessionLog].reverse().map((entry, i) => (
              <div key={entry.ts} className="flex items-start gap-4">
                <span className="text-[10px] text-muted-foreground/40 font-mono w-5 mt-0.5 tabular-nums flex-shrink-0">
                  {sessionLog.length - i}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium truncate">{entry.label}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">{entry.duration}m</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(entry.ts)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Decisions ────────────────────────────────────────────────────────────────

function Decisions({ decisions, onDecisionsChange }: { decisions: Decision[]; onDecisionsChange: (d: Decision[]) => void }) {
  const [situation, setSituation] = useState("");
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");

  const log = (e: React.FormEvent) => {
    e.preventDefault();
    if (!situation.trim() || !choice.trim()) return;
    onDecisionsChange([{ id: Date.now(), situation: situation.trim(), choice: choice.trim(), reason: reason.trim(), createdAt: new Date().toISOString() }, ...decisions]);
    setSituation(""); setChoice(""); setReason("");
  };

  const remove = (id: number) => onDecisionsChange(decisions.filter((d) => d.id !== id));

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[360px_1fr] h-full overflow-hidden">
      <div className="border-b lg:border-b-0 lg:border-r border-border flex flex-col overflow-y-auto">
        <div className="px-6 py-5 border-b border-border flex-shrink-0">
          <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">Decision journal</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">Log a decision</h1>
        </div>
        <form onSubmit={log} className="p-6 space-y-4 flex-1">
          <div>
            <label className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground block mb-1.5">Situation / question</label>
            <textarea value={situation} onChange={(e) => setSituation(e.target.value)} placeholder="What decision were you facing?" rows={3} className="w-full bg-transparent border border-border px-3 py-2.5 text-sm outline-none focus:border-accent/50 placeholder:text-muted-foreground/30 transition-colors resize-none" />
          </div>
          <div>
            <label className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground block mb-1.5">What you chose</label>
            <input value={choice} onChange={(e) => setChoice(e.target.value)} placeholder="The decision you made" className="w-full bg-transparent border border-border px-3 py-2.5 text-sm outline-none focus:border-accent/50 placeholder:text-muted-foreground/30 transition-colors" />
          </div>
          <div>
            <label className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground block mb-1.5">Why <span className="text-muted-foreground/40 normal-case tracking-normal">(optional)</span></label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What was the reasoning?" rows={3} className="w-full bg-transparent border border-border px-3 py-2.5 text-sm outline-none focus:border-accent/50 placeholder:text-muted-foreground/30 transition-colors resize-none" />
          </div>
          <button type="submit" className="w-full bg-foreground text-background text-xs py-2.5 hover:opacity-80 transition-opacity">Log decision</button>
        </form>
      </div>
      <div className="flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">History</span>
          <span className="text-[10px] text-muted-foreground">{decisions.length} logged</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {decisions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="text-[10px] tracking-widest uppercase text-muted-foreground mb-2">No decisions yet</div>
              <p className="text-sm text-muted-foreground">Your decision log will appear here.</p>
            </div>
          ) : (
            decisions.map((d) => (
              <div key={d.id} className="border-b border-border px-6 py-5 group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground">{timeAgo(d.createdAt)}</span>
                  <button onClick={() => remove(d.id)} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">Remove</button>
                </div>
                <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{d.situation}</p>
                <div className="flex items-start gap-2 mb-1">
                  <ChevronRight className="size-3.5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-medium">{d.choice}</span>
                </div>
                {d.reason && <p className="text-xs text-muted-foreground pl-5 leading-relaxed">{d.reason}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Onboarding Modal ─────────────────────────────────────────────────────────

function OnboardingModal({ answers, onDismiss, onComplete, onAnswersChange }: {
  answers: Partial<OnboardingAnswers>;
  onDismiss: () => void;
  onComplete: (a: Partial<OnboardingAnswers>) => void;
  onAnswersChange: (a: Partial<OnboardingAnswers>) => void;
}) {
  const [step, setStep] = useState(0);
  const [local, setLocal] = useState<Partial<OnboardingAnswers>>(answers);
  const current = OB_STEPS[step];
  const total = OB_STEPS.length;

  const setAnswer = (field: keyof OnboardingAnswers, value: string) => {
    const next = { ...local, [field]: value };
    setLocal(next);
    onAnswersChange(next);
  };

  const handleNext = () => {
    if (step < total - 1) setStep((s) => s + 1);
    else onComplete(local);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-background border border-border w-full max-w-[440px] relative">
        <button onClick={onDismiss} className="absolute top-3.5 right-3.5 size-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors">
          <X className="size-3.5" />
        </button>
        <div className="h-px bg-border">
          <div className="h-full bg-accent transition-all duration-300" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
        <div className="px-7 pt-6 pb-0">
          <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">Quick setup · {step + 1} of {total}</p>
          <h2 className="font-display text-xl font-bold tracking-tight mt-1">{current.question}</h2>
          <p className="text-xs text-muted-foreground mt-1.5">{current.hint}</p>
        </div>
        <div className="px-7 py-6 min-h-[160px]">
          {current.type === "chip" && current.options && (
            <div className="flex flex-wrap gap-2">
              {current.options.map((opt) => (
                <button key={opt} onClick={() => setAnswer(current.id, opt)} className={`px-3.5 py-2 text-xs border transition-colors ${local[current.id] === opt ? "border-accent text-accent bg-accent/10" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}>
                  {opt}
                </button>
              ))}
            </div>
          )}
          {current.type === "text" && (
            <input autoFocus value={(local[current.id] as string) ?? ""} onChange={(e) => setAnswer(current.id, e.target.value)} placeholder={current.placeholder} className="w-full bg-transparent border border-border px-4 py-3 text-sm outline-none focus:border-accent/60 placeholder:text-muted-foreground/40 transition-colors" />
          )}
        </div>
        <div className="px-7 pb-6 flex items-center justify-between">
          <button onClick={onDismiss} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Do it later</button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 border border-border hover:bg-surface-hover">Back</button>
            )}
            <button onClick={handleNext} className="bg-foreground text-background text-xs font-medium px-5 py-2 hover:opacity-80 transition-opacity">
              {step < total - 1 ? "Continue" : "Finish setup"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Onboarding Panel ─────────────────────────────────────────────────────────

function OnboardingPanel({ onboarding, onComplete, onReset, onAnswersChange }: {
  onboarding: OnboardingData;
  onComplete: (a: Partial<OnboardingAnswers>) => void;
  onReset: () => void;
  onAnswersChange: (a: Partial<OnboardingAnswers>) => void;
}) {
  if (onboarding.completed) return <OnboardingResults onboarding={onboarding} onReset={onReset} />;
  return <OnboardingForm answers={onboarding.answers} onComplete={onComplete} onAnswersChange={onAnswersChange} />;
}

function OnboardingForm({ answers, onComplete, onAnswersChange }: {
  answers: Partial<OnboardingAnswers>;
  onComplete: (a: Partial<OnboardingAnswers>) => void;
  onAnswersChange: (a: Partial<OnboardingAnswers>) => void;
}) {
  const [step, setStep] = useState(0);
  const [local, setLocal] = useState<Partial<OnboardingAnswers>>(answers);
  const current = OB_STEPS[step];
  const total = OB_STEPS.length;

  const setAnswer = (field: keyof OnboardingAnswers, value: string) => {
    const next = { ...local, [field]: value };
    setLocal(next);
    onAnswersChange(next);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 lg:px-8 py-5 border-b border-border flex-shrink-0">
        <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">Personalization</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Setup</h1>
      </div>
      <div className="px-6 lg:px-8 pt-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Step {step + 1} of {total}</p>
          <p className="text-[11px] text-muted-foreground">{Math.round(((step + 1) / total) * 100)}%</p>
        </div>
        <div className="h-px bg-border">
          <div className="h-full bg-accent transition-all duration-300" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 pt-7 pb-6">
        <h2 className="font-display text-lg font-bold tracking-tight mb-1">{current.question}</h2>
        <p className="text-xs text-muted-foreground mb-6">{current.hint}</p>
        {current.type === "chip" && current.options && (
          <div className="flex flex-wrap gap-2">
            {current.options.map((opt) => (
              <button key={opt} onClick={() => setAnswer(current.id, opt)} className={`px-3.5 py-2 text-xs border transition-colors ${local[current.id] === opt ? "border-accent text-accent bg-accent/10" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}>
                {opt}
              </button>
            ))}
          </div>
        )}
        {current.type === "text" && (
          <input autoFocus value={(local[current.id] as string) ?? ""} onChange={(e) => setAnswer(current.id, e.target.value)} placeholder={current.placeholder} className="w-full bg-transparent border border-border px-4 py-3 text-sm outline-none focus:border-accent/60 placeholder:text-muted-foreground/40 transition-colors" />
        )}
      </div>
      <div className="border-t border-border px-6 lg:px-8 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="text-xs text-muted-foreground hover:text-foreground transition-colors border border-border px-3 py-2 hover:bg-surface-hover">Back</button>
          )}
        </div>
        <button onClick={() => { if (step < total - 1) setStep((s) => s + 1); else onComplete(local); }} className="bg-foreground text-background text-xs font-medium px-5 py-2 hover:opacity-80 transition-opacity">
          {step < total - 1 ? "Continue" : "Finish setup"}
        </button>
      </div>
    </div>
  );
}

function OnboardingResults({ onboarding, onReset }: { onboarding: OnboardingData; onReset: () => void }) {
  const { answers, completedAt } = onboarding;
  const filled = (Object.keys(RESULT_LABELS) as (keyof OnboardingAnswers)[]).filter((k) => answers[k]).map((k) => ({ key: k, label: RESULT_LABELS[k], value: answers[k] as string }));
  const completedDate = completedAt ? new Date(completedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 lg:px-8 py-5 border-b border-border flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">{completedDate ? `Completed ${completedDate}` : "Setup complete"}</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">Your profile</h1>
        </div>
        <div className="size-2 bg-accent flex-shrink-0" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filled.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">No answers were recorded.</p>
            <button onClick={onReset} className="text-xs border border-border px-4 py-2 hover:bg-surface-hover transition-colors">Start setup</button>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {filled.map(({ key, label, value }) => (
                <div key={key} className="px-6 lg:px-8 py-5">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">{label}</div>
                  <div className="text-sm font-medium">{value}</div>
                </div>
              ))}
            </div>
            <div className="px-6 lg:px-8 py-8 border-t border-border">
              <p className="text-xs text-muted-foreground mb-5 leading-relaxed">Your profile helps mindflowAI surface relevant nudges, suggestions, and focus prompts tailored to your goals.</p>
              <button onClick={onReset} className="text-xs text-muted-foreground hover:text-foreground border border-border px-4 py-2 transition-colors hover:bg-surface-hover">Redo onboarding</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
