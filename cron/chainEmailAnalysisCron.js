const cron = require("node-cron");
const ChainAdmin = require("../models/ChainAdmin");
const { computeShopEntry } = require("../controllers/chainAdminController");
const { sendChainDailyAnalysisEmail } = require("../utils/emailService");
const {buildShopInsight} = require("../utils/chainAnalysisInsights");
const {getDateRange } = require("../utils/dateRanges");

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


const runChainEmailAnalysis = async () => {
  const reportDate = new Date(); // report on the day that just ended, same convention as daily-summary cron
  reportDate.setHours(0, 0, 0, 0);

  const isSunday = reportDate.getDay() === 0;
  const isMonthEnd = isLastDayOfMonth(reportDate);
  const dateLabel = reportDate.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const chainAdmins = await ChainAdmin.find({ emailAnalysisEnabled: true }).populate("shops", "name");

  for (const chainAdmin of chainAdmins) {
    if (!chainAdmin.shops.length) continue;

    try {

     const daily = await buildSection(chainAdmin.shops, "daily", reportDate);
     const weekly = isSunday ? await buildSection(chainAdmin.shops, "weekly", reportDate) : null;
     const monthly = isMonthEnd ? await buildSection(chainAdmin.shops, "monthly", reportDate) : null;

      await sendChainDailyAnalysisEmail(chainAdmin.email, chainAdmin.name, dateLabel, { daily, weekly, monthly });
    } catch (err) {
      console.error(`[chain-email-analysis] failed for chain admin ${chainAdmin._id}:`, err.message);
    }
  }

  console.log(`[chain-email-analysis] processed ${chainAdmins.length} chain admin(s) for ${dateLabel}`);
};

const startChainEmailAnalysisCron = () => {
  // Runs after the 1am daily-summary cron so computeShopEntry's underlying
  // data (DailySummary rows) is already settled for "yesterday".
  cron.schedule(
    "12 17 * * *",
    async () => {
      try {
        await runChainEmailAnalysis();
      } catch (err) {
        console.error("[chain-email-analysis] run failed:", err.message);
      }
    },
    { timezone: TIMEZONE }
  );

  console.log(`[chain-email-analysis] cron scheduled "3 17 * * *" (${TIMEZONE})`);
};

module.exports = { startChainEmailAnalysisCron, runChainEmailAnalysis, buildSection,isLastDayOfMonth };