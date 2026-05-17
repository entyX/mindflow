import { createServerFn } from "@tanstack/react-start";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { ChatMessage, DashboardContext } from "./ai-engine";

export interface AppAction {
  name: "navigate" | "start_timer" | "add_task" | "add_tasks" | "add_goal";
  args: Record<string, unknown>;
}

function buildSystemPrompt(ctx: DashboardContext): string {
  const name = ctx.user.name.split(" ")[0];
  const pending = ctx.tasks.filter((t) => !t.done);
  const done = ctx.tasks.filter((t) => t.done);
  const high = pending.filter((t) => t.priority === "High");
  const activeGoals = ctx.goals.filter((g) => !g.done);

  const taskLine =
    ctx.tasks.length === 0
      ? "No tasks added yet."
      : `${done.length}/${ctx.tasks.length} complete.${
          high.length > 0
            ? ` High-priority: ${high.map((t) => `"${t.text}"`).join(", ")}.`
            : ""
        }${
          pending.length > 0
            ? ` Pending: ${pending.map((t) => `"${t.text}" (${t.priority})`).join(", ")}.`
            : ""
        }`;

  const goalLine =
    activeGoals.length === 0
      ? "No active goals."
      : activeGoals.map((g) => `"${g.title}" — ${g.progress}% of ${g.target}`).join(", ") + ".";

  const profileLine = ctx.onboarding.completed
    ? [
        ctx.onboarding.answers.role && `Role: ${ctx.onboarding.answers.role}`,
        ctx.onboarding.answers.challenge && `Challenge: ${ctx.onboarding.answers.challenge}`,
        ctx.onboarding.answers.monthGoal && `Month goal: "${ctx.onboarding.answers.monthGoal}"`,
      ]
        .filter(Boolean)
        .join(". ")
    : "Onboarding not completed.";

  const toneInstructions: Record<string, string> = {
    direct: "Be direct and no-fluff. Short punchy sentences. Give the answer, skip preamble. No softening.",
    gentle: "Be warm, encouraging, and patient. Acknowledge effort and feelings before redirecting. Never sound harsh or demanding.",
    hype: "Be enthusiastic and energetic — their personal hype machine. Build them up, make them feel unstoppable. Use exclamation marks naturally.",
    strict: "Be tough. High expectations, no excuses. If they're slacking, say so plainly. Tough love, not cruelty.",
    chill: "Be casual and conversational — like a smart friend, not a manager or coach. Low pressure, relaxed language, high trust.",
  };
  const tone = ctx.tone && toneInstructions[ctx.tone] ? ctx.tone : "direct";
  const toneInstruction = toneInstructions[tone];

  return `You are mindflowAI — a productivity coach embedded in a personal dashboard app.

User: ${name}
Tasks: ${taskLine}
Focus sessions today: ${ctx.todaySessions}
Goals: ${goalLine}
Decisions logged: ${ctx.decisions.length}
Profile: ${profileLine}

Tone: ${toneInstruction}

Rules:
- Reference their actual data when relevant — specific task names, goal percentages, session counts.
- Match length to the question type:
    • Action/focus questions ("what should I work on?", "start a timer") → 1–3 sentences, direct.
    • Brainstorming, planning, or "help me think through X" → elaborate freely. Use lists, headers, examples. Go deep.
    • Analysis or reflection ("how am I doing?", "why do I keep procrastinating?") → 3–6 sentences with real insight.
- Skip filler phrases like "Great question!" or "Certainly!".
- If they ask what to focus on, pick the highest-priority open task and tell them to start the timer.
- You have tools to take direct action in the app. Use them when the user asks you to do something:
  navigate (switch tabs), start_timer (start a focus session), add_task, add_goal.
- When you use a tool, keep your text reply short — one sentence confirming what you did.`;
}

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "navigate",
        description: "Navigate the user to a specific section of the dashboard",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tab: {
              type: SchemaType.STRING,
              description: "The tab to navigate to",
              enum: ["overview", "goals", "focus", "decisions"],
            },
          },
          required: ["tab"],
        },
      },
      {
        name: "start_timer",
        description: "Start a focus timer with the given duration and navigate to the Focus tab",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            minutes: {
              type: SchemaType.NUMBER,
              description: "Duration in minutes (1–120)",
            },
            label: {
              type: SchemaType.STRING,
              description: "What the user is working on — used as the session label (optional)",
            },
          },
          required: ["minutes"],
        },
      },
      {
        name: "add_task",
        description: "Add a single task to the user's task list. For 2 or more tasks, use add_tasks instead.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            text: {
              type: SchemaType.STRING,
              description: "The task description",
            },
            priority: {
              type: SchemaType.STRING,
              description: "Priority level",
              enum: ["High", "Med", "Low"],
            },
          },
          required: ["text", "priority"],
        },
      },
      {
        name: "add_tasks",
        description: "Add multiple tasks at once. Use this whenever creating 2 or more tasks.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tasks: {
              type: SchemaType.ARRAY,
              description: "List of tasks to add",
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  text: { type: SchemaType.STRING, description: "Task description" },
                  priority: { type: SchemaType.STRING, description: "Priority level", enum: ["High", "Med", "Low"] },
                },
                required: ["text", "priority"],
              },
            },
          },
          required: ["tasks"],
        },
      },
      {
        name: "add_goal",
        description: "Add a new goal to the user's goal list",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            title: {
              type: SchemaType.STRING,
              description: "Goal title",
            },
            target: {
              type: SchemaType.STRING,
              description: "What success looks like, e.g. '10 of 10 chapters' or '$5k MRR'",
            },
          },
          required: ["title", "target"],
        },
      },
    ],
  },
];

// Payload is JSON-stringified to avoid TanStack's serializable constraint on Array<unknown>
export const geminiChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as string)
  .handler(async ({ data }) => {
    const { messages, context } = JSON.parse(data) as {
      messages: ChatMessage[];
      context: DashboardContext;
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server.");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: buildSystemPrompt(context),
      tools: TOOLS,
    });

    // Gemini requires history to start with a user turn — drop leading assistant messages
    const priorMsgs = messages.slice(0, -1);
    const firstUserIdx = priorMsgs.findIndex((m) => m.role === "user");
    const historyMsgs = firstUserIdx === -1 ? [] : priorMsgs.slice(firstUserIdx);
    const history = historyMsgs.map((msg) => ({
      role: msg.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: msg.content }],
    }));

    const lastMsg = messages[messages.length - 1];
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMsg.content);
    const response = result.response;

    const functionCalls = response.functionCalls() ?? [];
    if (functionCalls.length > 0) {
      // Confirm tool execution to Gemini so it produces its final reply text
      const confirmParts = functionCalls.map((fc) => ({
        functionResponse: { name: fc.name, response: { result: "success" } },
      }));
      const finalResult = await chat.sendMessage(confirmParts);
      return {
        text: finalResult.response.text(),
        actions: functionCalls.map((fc) => ({
          name: fc.name as AppAction["name"],
          args: (fc.args ?? {}) as Record<string, unknown>,
        })),
      };
    }

    return { text: response.text(), actions: [] as AppAction[] };
  });
