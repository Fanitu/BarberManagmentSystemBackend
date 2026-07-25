const cron = require("node-cron");
const ServiceLog = require("../models/ServiceLog");
const RunningCost = require("../models/RunningCost");
const DailySummary = require("../models/DailySummary");
const BarberShop = require("../models/BarberShop");

const TIMEZONE = process.env.SUMMARY_TIMEZONE || "Africa/Addis_Ababa";
const BACKFILL_DAYS = 7; // how many past days to re-check on server startup

/**
 * Generates (upserts) the daily summary for one shop, one day.
 */
async function generateDailySummary(barberShopId, date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const [serviceData, runningCostData] = await Promise.all([
    ServiceLog.aggregate([
      { $match: { barberShop: barberShopId, createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$price" },
          barbersPayment: {
            $sum: {
              $multiply: [
                "$price",
                { $divide: [{ $subtract: [100, "$shopPercent"] }, 100] },
              ],
            },
          },
          orderCount: { $sum: 1 },
        },
      },
    ]),
    RunningCost.aggregate([
      { $match: { barberShop: barberShopId, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]),
  ]);

  const revenue = serviceData[0] || { totalRevenue: 0, barbersPayment: 0, orderCount: 0 };
  const runningCostTotal = runningCostData[0]?.total || 0;
  const totalIncome = revenue.totalRevenue - revenue.barbersPayment - runningCostTotal;

  await DailySummary.updateOne(
    { barberShop: barberShopId, date: start },
    {
      $set: {
        totalRevenue: revenue.totalRevenue,
        barbersPayment: revenue.barbersPayment,
        runningCost: runningCostTotal,
        totalIncome,
        orderCount: revenue.orderCount,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

/**
 * Generates summaries for every shop, for one specific date.
 * With { skipExisting: true }, shops that already have a row for that
 * day are left untouched instead of being recomputed.
 */
async function generateSummariesForDate(date, { skipExisting = false } = {}) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const shops = await BarberShop.find({}, "_id");

  let targetShops = shops;
  if (skipExisting) {
    const existing = await DailySummary.find({ date: start }, "barberShop").lean();
    const existingIds = new Set(existing.map((s) => String(s.barberShop)));
    targetShops = shops.filter((shop) => !existingIds.has(String(shop._id)));
  }

  if (targetShops.length === 0) {
    console.log(`[daily-summary] ${start.toISOString().split("T")[0]} already up to date, skipping`);
    return;
  }

  await Promise.all(targetShops.map((shop) => generateDailySummary(shop._id, date)));
  console.log(
    `[daily-summary] generated for ${start.toISOString().split("T")[0]} (${targetShops.length}/${shops.length} shop(s))`
  );
}

/**
 * Re-generates the last `daysBack` days for every shop. Safe to run
 * repeatedly (each day is an upsert) — this exists so a missed cron run
 * (deploy, crash, cold start) doesn't leave a permanent gap that makes
 * getDailySummaryTotals() silently refuse that range forever. Deliberately
 * never touches today — today's summary isn't final until the day is over.
 */
async function backfillRecentSummaries(daysBack = BACKFILL_DAYS) {
  console.log(`[daily-summary] checking the last ${daysBack} day(s) for gaps...`);
  for (let i = 1; i <= daysBack; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    await generateSummariesForDate(date, { skipExisting: true });
  }
  console.log("[daily-summary] backfill check complete");
}

function startDailySummaryCron() {
  // Catch up immediately on startup, in case last night's run was missed.
  backfillRecentSummaries().catch((err) =>
    console.error("[daily-summary] startup backfill failed:", err.message)
  );

  cron.schedule(
    "0 1 * * *",
    async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      try {
        await generateSummariesForDate(yesterday);
      } catch (err) {
        console.error("[daily-summary] nightly generation failed:", err.message);
      }
    },
    { timezone: TIMEZONE }
  );

  console.log(`[daily-summary] cron scheduled "0 1 * * *" (${TIMEZONE})`);
}

module.exports = {
  startDailySummaryCron,
  generateDailySummary,
  generateSummariesForDate,
  backfillRecentSummaries,
};
