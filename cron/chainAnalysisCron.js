const cron = require("node-cron");
const ChainAdmin = require("../models/ChainAdmin");
const { computeShopEntry } = require("../controllers/chainAdminController");
const { sendChainDailyAnalysisEmail } = require("../utils/emailService");
const { sendTelegramMessage } = require("../bot/telegramBot");
const { buildTelegramAnalysisMessage } = require("../utils/telegramAnalsisFormat");
const { buildShopInsight } = require("../utils/chainAnalysisInsights");
const { getDateRange } = require("../utils/dateRanges");
const { generateAccountingNarrative } = require("../utils/aiNarative");
const Sentry = require("@sentry/node");

const TIMEZONE = process.env.SUMMARY_TIMEZONE || "Africa/Addis_Ababa";

const isLastDayOfMonth = (date) => {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next.getDate() === 1;
};

const getPreviousReferenceDate = (period, referenceDate) => {
  const d = new Date(referenceDate);
  if (period === "daily") d.setDate(d.getDate() - 1);
  else if (period === "weekly") d.setDate(d.getDate() - 7);
  else if (period === "monthly") d.setMonth(d.getMonth() - 1);
  return d;
};

const buildSection = async (shops, period, referenceDate) => {
  const { start, end } = getDateRange(period, referenceDate);
  const previousDate = getPreviousReferenceDate(period, referenceDate);

  const rows = [];
  const insights = [];

  for (const shop of shops) {
    const entry = await computeShopEntry(shop._id, period, referenceDate);
    rows.push({ name: shop.name, ...entry });

    const prevEntry = await computeShopEntry(shop._id, period, previousDate);
    const lines = await buildShopInsight(shop, period, start, end, entry.totalRevenue, prevEntry.totalRevenue);
    insights.push(...lines);
  }

  return { rows, insights };
};

// One Groq call per section, reused by both email and Telegram.
const attachNarrative = async (section, period, meta) => {
  if (!section) return section;
  section.narrative = await generateAccountingNarrative(period, section.rows, section.insights, meta);
  return section;
};

const runChainAnalysis = async () => {
  const reportDate = new Date();
  reportDate.setHours(0, 0, 0, 0);

  const isSunday = reportDate.getDay() === 0;
  const isMonthEnd = isLastDayOfMonth(reportDate);
  const dateLabel = reportDate.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Union of both channels' recipients — a chain_admin on either or both
  // channels gets exactly one data-build + one set of Groq calls.
  const chainAdmins = await ChainAdmin.find({
    $or: [{ emailAnalysisEnabled: true }, { telegramAnalysisEnabled: true, telegramChatId: { $ne: null } }],
  }).populate("shops", "name");

  for (const chainAdmin of chainAdmins) {
    if (!chainAdmin.shops.length) continue;

    try {
      const meta = { chainAdminId: chainAdmin._id.toString() };

      const daily = await buildSection(chainAdmin.shops, "daily", reportDate);
      const weekly = isSunday ? await buildSection(chainAdmin.shops, "weekly", reportDate) : null;
      const monthly = isMonthEnd ? await buildSection(chainAdmin.shops, "monthly", reportDate) : null;

      await attachNarrative(daily, "daily", { ...meta, period: "daily" });
      await attachNarrative(weekly, "weekly", { ...meta, period: "weekly" });
      await attachNarrative(monthly, "monthly", { ...meta, period: "monthly" });

      const sections = { daily, weekly, monthly };

      if (chainAdmin.emailAnalysisEnabled) {
        try {
          await sendChainDailyAnalysisEmail(chainAdmin.email, chainAdmin.name, dateLabel, sections);
        } catch (err) {
          console.error(`[chain-analysis] email failed for ${chainAdmin._id}:`, err.message);
          Sentry.captureException(err);
        }
      }

      if (chainAdmin.telegramAnalysisEnabled && chainAdmin.telegramChatId) {
        try {
          const text = buildTelegramAnalysisMessage(dateLabel, sections);
          await sendTelegramMessage(chainAdmin.telegramChatId, text);
        } catch (err) {
          console.error(`[chain-analysis] telegram failed for ${chainAdmin._id}:`, err.message);
          Sentry.captureException(err);
        }
      }
    } catch (err) {
      console.error(`[chain-analysis] failed for chain admin ${chainAdmin._id}:`, err.message);
      Sentry.captureException(err);
    }
  }

  console.log(`[chain-analysis] processed ${chainAdmins.length} chain admin(s) for ${dateLabel}`);
};

const startChainAnalysisCron = () => {
  cron.schedule(
    "00 21 * * *", // 9:00 PM Addis Ababa time
    async () => {
      try {
        await runChainAnalysis();
      } catch (err) {
        console.error("[chain-analysis] run failed:", err.message);
        Sentry.captureException(err);
      }
    },
    { timezone: TIMEZONE }
  );
  console.log(`[chain-analysis] cron scheduled "0 21 * * *" (${TIMEZONE})`);
};


module.exports = { startChainAnalysisCron, runChainAnalysis, buildSection, isLastDayOfMonth, attachNarrative };