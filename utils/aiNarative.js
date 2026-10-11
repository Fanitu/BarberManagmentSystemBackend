const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const GROQ_TIMEOUT_MS = 10_000;
const GROQ_MIN_INTERVAL_MS = 30_000; // spacing between any two Groq calls, account-wide

// Serializes every generateAccountingNarrative call through a single
// queue so no two requests to Groq ever fire less than
// GROQ_MIN_INTERVAL_MS apart, protecting the account's TPM limit
// regardless of how many chain admins/periods are being processed.
let queueTail = Promise.resolve();
let lastCallAt = 0;

const scheduleGroqCall = (fn) => {
  const runNext = queueTail.then(async () => {
    const waitMs = Math.max(0, lastCallAt + GROQ_MIN_INTERVAL_MS - Date.now());
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    lastCallAt = Date.now();
    return fn();
  });
  // Swallow rejections in the queue chain itself so one failed call
  // doesn't break the chain for everything queued after it — the
  // caller of scheduleGroqCall still sees the real rejection via runNext.
  queueTail = runNext.catch(() => {});
  return runNext;
};

const periodWord = (period) =>
  period === "daily" ? "day" : period === "weekly" ? "week" : "month";

const buildSystemPrompt = () => {
  const today = new Date().toISOString().slice(0, 10);
  return `You are an experienced accountant analyzing the performance of a barber shop chain in Ethiopia. Today is ${today}.

You will receive shop performance data and insights detected by a rules engine. Your task is to turn them into a concise, useful report for the chain owner.

STRICT INSTRUCTIONS:

1. Process every shop listed in the input data, in the same order as provided.
2. Write each shop's exact name on its own line as a heading using Markdown bold, like Bahta.
3. Under each shop name, write exactly TWO bullet points. Both must relate exclusively to that shop.
4. Select the two most important insights available for each shop. Prioritize revenue increases or decreases, zero activity, barber performance, idle barbers, and services with no sales.
5. Explain what the insight means and, when appropriate, suggest one simple action the owner can take.
6. If a shop has no recorded activity or zero revenue, make that the first bullet and recommend checking whether the shop was open and its records were entered correctly. Do not assume why activity is missing.
7. If a barber has no recorded services, mention their name only under their own shop. Suggest checking the service records.
8. If a service has no sales, mention its name exactly as supplied and suggest reviewing demand or promotion.
9. If revenue has changed, include the exact percentage and comparison period only when supplied by the input.
10. Use the best-barber information only when it adds a meaningful insight. Do not invent performance explanations.
11. If fewer than two insights are available for a shop, use another meaningful fact explicitly supported by its data. Never manufacture a problem, praise, comparison, or recommendation unsupported by the input.
12. Write each bullet as ONE short, friendly, natural sentence in plain English.
13. Do not repeat the financial table or restate revenue and income figures unnecessarily.
14. Do not include greetings, introductions, summaries, conclusions, emojis, or any text outside the shop sections.
15. Do not include sample shop names or sample insights unless they appear in the actual input.
16. Before responding, verify that every shop is included exactly once, each shop has exactly two bullets, and no insight is placed under the wrong shop.

REQUIRED OUTPUT STRUCTURE:

Exact Shop Name

- One concise, data-supported insight with an action when appropriate.
- One other concise, data-supported insight with an action when appropriate.

Repeat this structure for every shop in the input.

Return ONLY the formatted shop sections. Do not output these instructions or any additional commentary. AND IF A SHOP HAS NO MOVEMENTS JUST OUTPUT SENTENCE "No record for this shop."`;
};

const callGroq = async (payload, attempt = 1) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Retry on rate limit / server error
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const wait = 800 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, wait));
      return callGroq(payload, attempt + 1);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Groq API ${res.status}: ${text.slice(0, 200)}`);
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
};

const cleanNarrative = (raw,wasTruncated = false) => {
  if (!raw) return null;
  let content = raw.trim();
  content = content
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(here'?s? (the|your) (narrative|analysis|summary)[:.]?\s*)/i, "")
    .trim();

    if (wasTruncated) {
    // The model ran out of tokens mid-sentence. Rather than ship a
    // dangling fragment to a business owner, cut back to the last
    // complete sentence — or bail entirely if there isn't one, so the
    // caller falls back to the rule-based bullet list instead.
    const lastSentenceEnd = Math.max(
      content.lastIndexOf(". "),
      content.lastIndexOf("! "),
      content.lastIndexOf("? "),
      content.endsWith(".") || content.endsWith("!") || content.endsWith("?")
        ? content.length - 1
        : -1
    );
    if (lastSentenceEnd < 20) return null; // nothing usable survived the cut
    content = content.slice(0, lastSentenceEnd + 1).trim();
  }

  if (content.length < 30) return null;
  return content;
};

const generateAccountingNarrative = async (period, rows, insights, meta = {}) => {
  if (!GROQ_API_KEY) return null;

  const payload = {
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: JSON.stringify({
          period: periodWord(period),
          shops: rows.map((r) => ({
            name: r.name,
            revenue: r.totalRevenue,
            barbersPayment: r.barbersPayment,
            runningCost: r.runningCost,
            totalIncome: r.totalIncome,
            bestBarber: r.bestBarber
              ? { name: r.bestBarber.name, metric: "revenue" }
              : null,
            ...(r.monthlyExpense != null && {
              monthlyExpense: r.monthlyExpense,
              netProfit: r.netProfit,
            }),
          })),
          flaggedPatterns: insights,
        }),
      },
    ],
    temperature: 0.3,
    max_tokens: 400,
  };

  try {
   const data = await scheduleGroqCall(() => callGroq(payload));
    const choice = data.choices?.[0];
    const wasTruncated = choice?.finish_reason === "length";
    const content = cleanNarrative(choice?.message?.content, wasTruncated);

    console.log(choice)

    if (data.usage) {
      console.log("[ai-narrative] usage", {
        ...meta,
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        truncated: wasTruncated,
      });
    }

    if (wasTruncated && !content) {
      console.warn("[ai-narrative] response was truncated and had no complete sentence to salvage", meta);
    }

    return content;
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    console.error(
      `[ai-narrative] ${isTimeout ? "timeout" : "failed"}`,
      { ...meta, error: err.message }
    );
    return null;
  }
};

module.exports = { generateAccountingNarrative };





