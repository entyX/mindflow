export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  ts: string;
}

export interface DashboardContext {
  user: { name: string };
  tasks: Array<{ text: string; priority: "High" | "Med" | "Low"; done: boolean }>;
  goals: Array<{ title: string; progress: number; target: string; done: boolean }>;
  decisions: Array<unknown>;
  todaySessions: number;
  onboarding: {
    completed: boolean;
    answers: Partial<{ role: string; focus: string; challenge: string; monthGoal: string }>;
  };
  tone?: string;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateWelcomeMessage(ctx: DashboardContext): string {
  const name = ctx.user.name.split(" ")[0];
  const h = new Date().getHours();
  const salutation = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const pending = ctx.tasks.filter((t) => !t.done);
  const high = pending.filter((t) => t.priority === "High");
  const facts: string[] = [];

  if (ctx.tasks.length === 0) facts.push("no tasks added yet");
  else if (pending.length === 0) facts.push("all tasks complete ✓");
  else facts.push(`${pending.length} task${pending.length !== 1 ? "s" : ""} pending${high.length > 0 ? ` — ${high.length} high-priority` : ""}`);

  if (ctx.todaySessions > 0) facts.push(`${ctx.todaySessions} focus session${ctx.todaySessions !== 1 ? "s" : ""} today`);
  if (ctx.onboarding.answers?.monthGoal) facts.push(`goal: "${ctx.onboarding.answers.monthGoal}"`);

  return `${salutation}, ${name}. ${facts.length > 0 ? `Here's your snapshot: ${facts.join(", ")}. ` : ""}What can I help you with?`;
}

export function generateResponse(
  userMessage: string,
  _history: ChatMessage[],
  ctx: DashboardContext
): string {
  const lc = userMessage.toLowerCase().trim();
  const name = ctx.user.name.split(" ")[0];
  const pending = ctx.tasks.filter((t) => !t.done);
  const done = ctx.tasks.filter((t) => t.done);
  const high = pending.filter((t) => t.priority === "High");
  const activeGoals = ctx.goals.filter((g) => !g.done);
  const { todaySessions, onboarding } = ctx;
  const challenge = onboarding.answers?.challenge ?? "";
  const monthGoal = onboarding.answers?.monthGoal;

  // Greetings
  if (/^(hi|hello|hey|sup|yo|what.?s up|howdy)/.test(lc)) {
    return pick([
      `Hey ${name}! You have ${pending.length} task${pending.length !== 1 ? "s" : ""} open${high.length > 0 ? ` — ${high.length} high-priority` : ""}. ${todaySessions > 0 ? `${todaySessions} focus session${todaySessions !== 1 ? "s" : ""} in. Good momentum.` : "No focus sessions yet — ready to start one?"} What do you need?`,
      `Hi ${name}. Quick summary: ${pending.length} tasks pending, ${todaySessions} focus session${todaySessions !== 1 ? "s" : ""} today, ${activeGoals.length} goal${activeGoals.length !== 1 ? "s" : ""} active. How can I help?`,
    ]);
  }

  // What to prioritize / do next
  if (/what.*(should|do|next|work on|focus|priorit)|priorit|where.*start|help me (focus|start|decide what)|what.*(most important)|i don.?t know what/.test(lc)) {
    if (pending.length === 0) {
      return activeGoals.length > 0
        ? `Task list is clear. Connect your goals to action: "${activeGoals[0].title}" is at ${activeGoals[0].progress}% — what's one concrete step you can take right now?`
        : "Task list is clear and no active goals. Set your next target in the Goals tab — what do you want to achieve this week?";
    }
    if (high.length > 0) {
      return `Your highest-priority item is "${high[0].text}". ${high.length > 1 ? `You have ${high.length} high-priority tasks — work through them before touching anything else.` : ""} Open Focus mode, set 25 minutes, go.`;
    }
    return `${pending.length} tasks open. Start with "${pending[0].text}" — it's at the top of your queue. Block 25 minutes and don't switch.`;
  }

  // Tasks
  if (/\btask|todo|to.do|checklist|pending|backlog\b/.test(lc)) {
    if (ctx.tasks.length === 0) {
      return "Your task list is empty. Add your first task in the Overview tab — writing it down creates commitment.";
    }
    const rate = Math.round((done.length / ctx.tasks.length) * 100);
    return `${done.length}/${ctx.tasks.length} tasks complete (${rate}%). ${high.length > 0 ? `High priority: "${high[0].text}"${high.length > 1 ? ` + ${high.length - 1} more.` : "."}` : "No high-priority flags set."} ${rate === 100 ? "Solid day." : pending.length <= 2 ? "Almost there." : ""}`;
  }

  // Goals
  if (/\bgoal|progress|target|milestone|achiev|long.term\b/.test(lc)) {
    if (ctx.goals.length === 0) {
      return "No goals set yet. Head to the Goals tab to define what you're building toward — without a destination, it's hard to measure progress.";
    }
    if (activeGoals.length === 0) {
      return `All ${ctx.goals.length} goal${ctx.goals.length !== 1 ? "s" : ""} marked done. Set your next challenge in the Goals tab — you're in a momentum window.`;
    }
    const top = activeGoals[0];
    return `"${top.title}" — ${top.progress}% complete, target: ${top.target}. ${top.progress < 25 ? "Just getting started — consistency is the key right now." : top.progress < 75 ? "Good progress. What's blocking the next 10%?" : "Almost there. What's the final push?"}`;
  }

  // Focus / Pomodoro
  if (/\bfocus|pomodoro|25.?min|session|timer|deep work|flow\b/.test(lc)) {
    if (todaySessions === 0) {
      return challenge === "Procrastination"
        ? "No sessions yet. Procrastination feeds on indecision — open Focus mode and start the timer before you have a chance to overthink it. Just 25 minutes."
        : "No focus sessions today. Head to the Focus tab. Twenty-five minutes of unbroken work compounds into results. Start now.";
    }
    return `${todaySessions} session${todaySessions !== 1 ? "s" : ""} today — ${Math.round(todaySessions * 25)} minutes of deep work. ${todaySessions < 2 ? "One more would make this a strong day." : todaySessions < 4 ? "Solid. Keep the momentum." : "Exceptional focus day. Take a proper break before pushing further."}`;
  }

  // Decisions
  if (/\bdecision|decide|choice|choose|option|trade.?off|should i\b/.test(lc)) {
    if (ctx.decisions.length === 0) {
      return "Your decision log is empty. The Decisions tab lets you journal choices — situation, what you picked, and why. Reviewing past decisions is one of the highest-leverage habits for better thinking.";
    }
    return `${ctx.decisions.length} decision${ctx.decisions.length !== 1 ? "s" : ""} logged. For your next choice: write the situation, list 2–3 options, and ask which you'd be comfortable defending in a week. That's usually the right call.`;
  }

  // Overwhelmed / too much
  if (/overwhelm|too much|can.?t cope|drowning|stress|anxious|everything at once/.test(lc)) {
    return pick([
      "Slow down. Pick ONE task — not the easiest, the most important. Do only that for 25 minutes. Everything else is noise until it's done.",
      "When it's all too much, narrow the scope. What's the single thing that would make today a success if you finished it? Start there, ignore everything else.",
    ]);
  }

  // Procrastination / stuck
  if (/procrastinat|can.?t start|don.?t know where|stuck|distract|not motivated|avoiding|putting.?off/.test(lc)) {
    return pick([
      "The moment you start, the resistance drops. Open Focus mode, start the timer, work for just 5 minutes — you won't stop there. The barrier is only at the beginning.",
      "Procrastination is often a signal you're unclear on the next action. Make it concrete: what is the single next physical step? Do that one thing.",
    ]);
  }

  // Progress / status
  if (/how am i doing|my progress|my status|give me an overview|how.?s it going|\bstatus\b|report|summary/.test(lc)) {
    const taskStatus = ctx.tasks.length === 0 ? "no tasks" : `${done.length}/${ctx.tasks.length} done`;
    const focusStatus = `${todaySessions} session${todaySessions !== 1 ? "s" : ""} today`;
    const goalStatus = activeGoals.length === 0 ? "no active goals" : `${activeGoals.length} goal${activeGoals.length !== 1 ? "s" : ""} in progress`;
    return `Snapshot: ${taskStatus}, ${focusStatus}, ${goalStatus}, ${ctx.decisions.length} decision${ctx.decisions.length !== 1 ? "s" : ""} logged. ${challenge ? `Your challenge is "${challenge}" — are you actively working against that pattern today?` : ""}`;
  }

  // Month goal
  if (monthGoal && /month|goal|working on|trying to|\baim\b/.test(lc)) {
    return `Your goal this month: "${monthGoal}". ${pending.length > 0 ? `Do any of your ${pending.length} open tasks directly advance that? If not, add one that does — alignment between daily tasks and goals is everything.` : "Task list is clear. Add your next concrete step toward that goal."}`;
  }

  // Tips / advice
  if (/\btip|advice|how to|help me|suggest|improve|better at\b/.test(lc)) {
    if (challenge === "Procrastination") return "For procrastination: act before you think. Set a 2-minute timer and start the smallest possible piece of the task. Momentum takes over from there.";
    if (challenge === "Too many priorities") return "Too many priorities = no priority. Write everything down, then force-rank. Do item #1. Don't touch #2 until #1 is done.";
    if (challenge === "Decision fatigue") return "To reduce decision fatigue: make important calls in the morning, batch small decisions, and default to 'no' for anything that doesn't clearly serve your goals.";
    if (challenge === "Staying focused") return "For focus: eliminate inputs first — close tabs, silence notifications, put your phone away. Then start the timer. You can't work around distraction; you have to remove it.";
    if (challenge === "Losing momentum") return "Momentum comes from visible wins. Track tasks, log focus sessions, update goal progress. The act of recording creates motivation to continue.";
    return "Three reliable moves: 1) Do your hardest task first. 2) Work in 25-minute blocks with real breaks. 3) Write tomorrow's top 3 priorities before you stop today.";
  }

  // Plan for the day
  if (/plan|today|schedule|agenda|routine|organize my day/.test(lc)) {
    if (pending.length === 0) {
      return monthGoal
        ? `Clean slate. Your month goal is "${monthGoal}" — what's the one action that would most advance it? Add it as a task and start a focus session.`
        : "No tasks queued. Set your intentions for the day — even 2–3 clear tasks creates structure.";
    }
    const topTasks = pending.slice(0, 3);
    return `Today's stack: ${topTasks.map((t, i) => `${i + 1}) ${t.text}`).join(", ")}${pending.length > 3 ? `, +${pending.length - 3} more` : ""}. Work top-down, use the Focus timer, don't context-switch.`;
  }

  // Catch-all
  return pick([
    "I can help you prioritize tasks, track goal progress, plan focus sessions, or think through decisions. What are you working on?",
    "Tell me more. I can pull from your dashboard data to help you prioritize, plan, or reflect.",
    "I'm tracking your tasks, goals, focus sessions, and decisions. What do you need right now?",
  ]);
}
