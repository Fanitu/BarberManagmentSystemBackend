const cron = require("node-cron");
const ChainAdmin = require("../models/ChainAdmin");
const { sendTelegramMessage } = require("../bot/telegramBot");
const { buildTelegramAnalysisMessage } = require("../utils/telegramAnalsisFormat");
// Reuse the same buildSection/getPreviousReferenceDate/isLastDayOfMonth
// helpers the email cron already defines — exporting them there instead
// of duplicating is cleaner long-term, but for now this file inlines
// them from the same source to avoid touching the working email cron.
const { buildSection, isLastDayOfMonth ,attachNarrative} = require("./chainEmailAnalysisCron");

const TIMEZONE = process.env.SUMMARY_TIMEZONE || "Africa/Addis_Ababa";

const runChainTelegramAnalysis = async () => {
  const reportDate = new Date();
  reportDate.setHours(0, 0, 0, 0);

  const isSunday = reportDate.getDay() === 0;
  const isMonthEnd = isLastDayOfMonth(reportDate);
  const dateLabel = reportDate.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const chainAdmins = await ChainAdmin.find({
    telegramAnalysisEnabled: true,
    telegramChatId: { $ne: null },
  }).populate("shops", "name");

  for (const chainAdmin of chainAdmins) {
    if (!chainAdmin.shops.length) continue;
    try {
      const daily = await buildSection(chainAdmin.shops, "daily", reportDate);
      const weekly = isSunday ? await buildSection(chainAdmin.shops, "weekly", reportDate) : null;
      const monthly = isMonthEnd ? await buildSection(chainAdmin.shops, "monthly", reportDate) : null;

      await attachNarrative(daily, "daily");
      await attachNarrative(weekly, "weekly");
      await attachNarrative(monthly, "monthly");

      const text = buildTelegramAnalysisMessage(dateLabel, { daily, weekly, monthly });
      await sendTelegramMessage(chainAdmin.telegramChatId, text);
    } catch (err) {
      console.error(`[chain-telegram-analysis] failed for chain admin ${chainAdmin._id}:`, err.message);
      Sentry.captureException(err);
    }
  }

  console.log(`[chain-telegram-analysis] processed ${chainAdmins.length} chain admin(s) for ${dateLabel}`);
};

const startChainTelegramAnalysisCron = () => {
  cron.schedule(
    "21 15 * * *",
    async () => {
      try {
        await runChainTelegramAnalysis();
      } catch (err) {
        console.error("[chain-telegram-analysis] run failed:", err.message);
        Sentry.captureException(err);
      }
    },
    { timezone: TIMEZONE }
  );
  console.log(`[chain-telegram-analysis] cron scheduled "52 17 * * *" (${TIMEZONE})`);
};

module.exports = { startChainTelegramAnalysisCron, runChainTelegramAnalysis };