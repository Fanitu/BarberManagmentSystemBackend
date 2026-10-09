const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const GROQ_TIMEOUT_MS = 10_000;

const periodWord = (period) =>
  period === "daily" ? "day" : period === "weekly" ? "week" : "month";

const buildSystemPrompt = () => {
  const today = new Date().toISOString().slice(0, 10);
  return `You are an experienced accountant writing a short, friendly briefing for the owner of a chain of barber shops in Ethiopia. Today is ${today}.

You will be given structured data about their shops' performance for one period (a day, week, or month), plus some flagged patterns already detected by a rules engine.

Write 3-5 sentences, plain conversational language, no jargon, no bullet points, no headers. Lead with the single most important takeaway. Mention specific shop or barber names when relevant. If something needs attention (a slow shop, an idle barber, an unsold service), say so plainly and suggest what the owner might look into — but stay warm, not alarmist. Do not restate every number from the table; the owner already sees the table. Your job is to add the "so what", not repeat the data. Never invent numbers you weren't given. Write in English.`;
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
    const data = await callGroq(payload);
    const choice = data.choices?.[0];
    const wasTruncated = choice?.finish_reason === "length";
    const content = cleanNarrative(choice?.message?.content, wasTruncated);

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