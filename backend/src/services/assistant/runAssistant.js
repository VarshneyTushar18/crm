const OpenAI = require("openai");
const { TOOL_DEFINITIONS, runTool } = require("./tools");
const { selectToolsForMessage } = require("./selectToolsForIntent");

const MAX_TOOL_ROUNDS = 6;
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

/** Keep enough context without blowing Groq TPM. */
const HISTORY_MESSAGES = 12;
const HISTORY_CHARS = 2500;

const EMPTY_REPLY_FALLBACK = "I couldn't generate a reply.";

const buildSystemPrompt = (actor = {}) => {
  const today = new Date().toISOString().slice(0, 10);
  const actorName = [actor.name, actor.surname].filter(Boolean).join(" ").trim() || "unknown";
  const actorEmail = actor.email || "";
  return `You are the Bright CRM admin assistant (ops, HR, finance, procurement, sales).

Admin: name="${actorName}", email="${actorEmail}".
"me"/"my"/"assigned to me" → this admin (e.g. list_leads assignedTo="me").

Rules:
- Always use tools for facts. Never invent records or numbers.
- Greetings / small talk → short friendly text reply with no tools.
- Always put the user-visible answer in message content (never leave content empty).
- Answer briefly in plain language; short bullets for lists.
- Job codes: markdown link with tool \`url\` only — [JB-1024](url). Never invent URLs.
- Job nicknames OK (customer/site words like "metro"). Prefer search_crm for vague find/lookup; list_jobs/get_* when the module is clear. If several jobs match, list with links and ask which.
- lockedValue = contract amount. Excel/export tools return downloadUrl — reply with [Download Excel report](downloadUrl); never paste CSV tables. Files are generated on click, not stored.
- Day off ALL workers: announce_company_day_off (default tomorrow Asia/Kolkata). One worker: mark_worker_day_off. Other emails: prepare_worker_email (draft only — admin must Approve & Send; never say already sent).
- CRM topics are in scope; refuse only clearly unrelated questions (weather/trivia).
- If no exact tool matches, use the closest similar tool from this turn (never reply "I don't have a tool" when a related list/get/search tool exists). Answer with that data and briefly note any limitation (e.g. no exact last-5-days filter → used list_employees with recentDays/createdAt).
- Charts: there is no chart renderer — use attendance/check-in summary tools or export_attendance_excel and describe the numbers (or give the download link).
- Today (UTC): ${today}. Day-off dates use Asia/Kolkata.
- Tool descriptions tell you which tool to call; pick the best match from the tools provided this turn.`;
};

const sanitizeMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        !(m.role === "assistant" && m.content.trim() === EMPTY_REPLY_FALLBACK)
    )
    .slice(-HISTORY_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, HISTORY_CHARS),
    }));
};

const latestUserText = (messages) => {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.role === "user" && typeof m.content === "string") return m.content;
  }
  return "";
};

/** Short greetings / thanks — skip tools for a fast Groq round-trip. */
const isGreetingOrChitchat = (text = "") => {
  const t = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[!?.…,]+$/g, "")
    .trim();
  if (!t || t.length > 40) return false;
  return /^(hi|hii+|hello|hey|yo|sup|hiya|howdy|good\s*(morning|afternoon|evening)|thanks|thank\s*you|ty|thx|ok|okay|cool|great|nice|bye|goodbye|see\s*ya|gm|gn)(\s+\w+){0,3}$/i.test(
    t
  );
};

const GREETING_SYSTEM = `You are the Bright CRM admin assistant. Reply briefly and warmly to greetings or thanks. Ask how you can help with CRM (jobs, attendance, invoices, leads). Do not invent CRM data. Always put your reply in message content.`;

/** gpt-oss often leaves content empty and puts text in reasoning_content. */
const extractReply = (msg) => {
  const content = String(msg?.content || "").trim();
  if (content) return content;
  const reasoning = String(msg?.reasoning_content || msg?.reasoning || "").trim();
  if (reasoning) return reasoning;
  return "";
};

/**
 * Groq rejects assistant messages that replay reasoning_content.
 * Only keep role/content/tool_calls for the next API round.
 */
const cleanAssistantMessage = (msg) => {
  const out = {
    role: "assistant",
    content: msg.content == null || msg.content === "" ? null : msg.content,
  };
  if (Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
    out.tool_calls = msg.tool_calls;
  }
  return out;
};

function createLlmClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured on the server.");
  }
  return new OpenAI({
    apiKey,
    baseURL: GROQ_BASE_URL,
  });
}

const emit = (onEvent, payload) => {
  if (typeof onEvent === "function") {
    try {
      onEvent(payload);
    } catch {
      // ignore listener errors
    }
  }
};

/**
 * Stream one completion. Emits content deltas only while in text mode
 * (stops emitting if tool_calls appear so UI doesn't flash junk).
 */
async function streamCompletion(openai, { messages, tools, toolChoice, onEvent }) {
  const params = {
    model: MODEL,
    messages,
    temperature: 0.2,
    stream: true,
  };
  if (tools?.length) {
    params.tools = tools;
    params.tool_choice = toolChoice || "auto";
  }

  const stream = await openai.chat.completions.create(params);

  let content = "";
  let reasoning = "";
  const toolCallMap = new Map();
  let mode = "unknown"; // unknown | text | tools
  let emittedAny = false;

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta || {};

    if (Array.isArray(delta.tool_calls) && delta.tool_calls.length) {
      if (mode === "text" && emittedAny) {
        emit(onEvent, { type: "reset" });
        emittedAny = false;
      }
      mode = "tools";
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        if (!toolCallMap.has(idx)) {
          toolCallMap.set(idx, {
            id: tc.id || "",
            type: "function",
            function: { name: "", arguments: "" },
          });
        }
        const acc = toolCallMap.get(idx);
        if (tc.id) acc.id = tc.id;
        if (tc.function?.name) acc.function.name += tc.function.name;
        if (tc.function?.arguments) acc.function.arguments += tc.function.arguments;
      }
    }

    const piece =
      typeof delta.content === "string"
        ? delta.content
        : "";
    if (piece) {
      content += piece;
      if (mode !== "tools") {
        mode = "text";
        emit(onEvent, { type: "delta", text: piece });
        emittedAny = true;
      }
    }

    const rPiece = delta.reasoning_content || delta.reasoning || "";
    if (typeof rPiece === "string" && rPiece) {
      reasoning += rPiece;
    }
  }

  const tool_calls = [...toolCallMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v)
    .filter((t) => t.function?.name);

  return {
    role: "assistant",
    content: content || null,
    ...(reasoning ? { reasoning_content: reasoning } : {}),
    ...(tool_calls.length ? { tool_calls } : {}),
    _emittedAny: emittedAny,
  };
}

async function streamTextOnly(openai, messages, onEvent) {
  const msg = await streamCompletion(openai, { messages, onEvent });
  let reply = extractReply(msg);
  if (!reply) {
    // Non-stream fallback (gpt-oss empty content quirks)
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.2,
    });
    reply = extractReply(completion.choices[0]?.message);
    if (reply) {
      emit(onEvent, { type: "reset" });
      emit(onEvent, { type: "delta", text: reply });
    }
  } else if (!msg._emittedAny && reply) {
    // Reply came from reasoning only — push once to UI
    emit(onEvent, { type: "delta", text: reply });
  }
  return reply || "";
}

/** Run all tool calls in parallel; append results in original order. */
async function runToolsParallel(toolCalls, toolContext, emailDrafts, messages) {
  const settled = await Promise.all(
    toolCalls.map(async (call) => {
      const name = call.function?.name;
      let args = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}");
      } catch {
        args = {};
      }
      let result;
      try {
        result = await runTool(name, args, toolContext);
      } catch (err) {
        result = { error: err.message || "Tool failed" };
      }
      return { call, result };
    })
  );

  for (const { call, result } of settled) {
    if (result?.requiresApproval && result?.draftId) {
      emailDrafts.push(result);
    }
    const payload = JSON.stringify(result);
    messages.push({
      role: "tool",
      tool_call_id: call.id,
      content: payload.length > 6000 ? `${payload.slice(0, 6000)}…` : payload,
    });
  }
}

async function runAssistantChat(userMessages, options = {}) {
  const actor = options.actor || {};
  const onEvent = options.onEvent;
  const openai = createLlmClient();
  const sanitized = sanitizeMessages(userMessages);
  const userText = latestUserText(userMessages);

  // Fast path: greetings / thanks — no tools, short prompt (streamed)
  if (isGreetingOrChitchat(userText)) {
    emit(onEvent, { type: "status", status: "thinking" });
    const greetingMessages = [
      { role: "system", content: GREETING_SYSTEM },
      ...sanitized.slice(-4),
    ];
    let reply = "";
    try {
      reply = await streamTextOnly(openai, greetingMessages, onEvent);
    } catch {
      reply = "";
    }
    if (!reply) {
      reply = "Hi! How can I help with Bright CRM today?";
      emit(onEvent, { type: "reset" });
      emit(onEvent, { type: "delta", text: reply });
    }
    return {
      reply,
      messages: sanitized.concat({ role: "assistant", content: reply }),
      emailDrafts: [],
    };
  }

  const tools = selectToolsForMessage(TOOL_DEFINITIONS, userText);
  const messages = [
    { role: "system", content: buildSystemPrompt(actor) },
    ...sanitized,
  ];
  const toolContext = { actor };
  const emailDrafts = [];

  let rounds = 0;
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds += 1;
    emit(onEvent, {
      type: "status",
      status: rounds === 1 ? "thinking" : "looking_up",
    });

    const msg = await streamCompletion(openai, {
      messages,
      tools,
      toolChoice: "auto",
      onEvent,
    });

    if (!msg) {
      throw new Error("Empty response from Groq");
    }

    messages.push(cleanAssistantMessage(msg));

    const toolCalls = msg.tool_calls;
    if (!toolCalls?.length) {
      let reply = extractReply(msg);
      if (!reply) {
        try {
          reply = await streamTextOnly(openai, messages, onEvent);
        } catch {
          reply = "";
        }
      } else if (!msg._emittedAny) {
        emit(onEvent, { type: "delta", text: reply });
      }
      reply = reply || EMPTY_REPLY_FALLBACK;
      if (reply === EMPTY_REPLY_FALLBACK && !msg._emittedAny) {
        emit(onEvent, { type: "delta", text: reply });
      }
      return {
        reply,
        messages: sanitized.concat({
          role: "assistant",
          content: reply,
        }),
        emailDrafts,
      };
    }

    // Tool round: clear any accidental streamed text, run tools in parallel
    emit(onEvent, { type: "reset" });
    emit(onEvent, { type: "status", status: "looking_up" });
    await runToolsParallel(toolCalls, toolContext, emailDrafts, messages);
  }

  const tooMany =
    "I need too many lookups for one question. Please ask something more specific.";
  emit(onEvent, { type: "delta", text: tooMany });
  return {
    reply: tooMany,
    messages: sanitized,
    emailDrafts,
  };
}

module.exports = { runAssistantChat };
