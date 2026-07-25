const mongoose = require("mongoose");
const ServiceLog = require("../models/ServiceLog");
const RunningCost = require("../models/RunningCost");
const MonthlyExpense = require("../models/MonthlyExpense");
const DailySummary = require("../models/DailySummary");
const { getDateRange } = require("../utils/dateRanges");

const DEFAULT_HISTORY_LIMITS = { daily: 14, weekly: 8, monthly: 6 };
const MAX_HISTORY_LIMIT = 14;
const MAX_SCAN = 30;
const SCAN_BATCH_SIZE = 10; // how many periods to compute in parallel per round
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Aggregates Total Revenue and Barbers Payment from ServiceLog for a range.
 * Barbers Payment = sum(price * (100 - shopPercent) / 100)  -> the barbers' cut.
 * Total Revenue   = sum(price)
 */
const aggregateServiceLogs = async (barberShop, start, end) => {
  const result = await ServiceLog.aggregate([
    {
      $match: {
        barberShop,
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$price" },
        barbersPayment: {
          $sum: {
            $multiply: ["$price", { $divide: [{ $subtract: [100, "$shopPercent"] }, 100] }],
          },
        },
      },
    },
  ]);

  return result[0] || { totalRevenue: 0, barbersPayment: 0 };
};

const sumRunningCosts = async (barberShop, start, end) => {
  const result = await RunningCost.aggregate([
    { $match: { barberShop, createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: null, total: { $sum: "$price" } } },
  ]);
  return result[0]?.total || 0;
};

const sumMonthlyExpenses = async (barberShop, monthStart) => {
  const result = await MonthlyExpense.aggregate([
    { $match: { barberShop, month: monthStart } },
    { $group: { _id: null, total: { $sum: "$price" } } },
  ]);
  return result[0]?.total || 0;
};

/**
 * Sums pre-computed DailySummary rows covering [start, end] — but ONLY
 * returns a result if every single day in that range has a row. A partial
 * match (a cron gap, a server restart that skipped a night, or a range
 * that includes today, whose summary doesn't exist until tomorrow's cron
 * run) is not good enough for money data — this returns null instead of
 * silently under-reporting, and the caller falls back to a live aggregate.
 */
const getDailySummaryTotals = async (barberShop, start, end) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Never trust summaries for a range touching today or later — today's
  // row doesn't exist until tomorrow's 1am cron run.
  if (end >= startOfToday) return null;

  const summaries = await DailySummary.find({
    barberShop,
    date: { $gte: start, $lte: end },
  }).lean();

  const expectedDays = Math.round((end - start) / ONE_DAY_MS) + 1;
  if (summaries.length < expectedDays) return null; // gap somewhere -> don't trust it

  return summaries.reduce(
    (acc, s) => ({
      totalRevenue: acc.totalRevenue + s.totalRevenue,
      barbersPayment: acc.barbersPayment + s.barbersPayment,
      runningCost: acc.runningCost + s.runningCost,
    }),
    { totalRevenue: 0, barbersPayment: 0, runningCost: 0 }
  );
};

/**
 * Computes the full metadata set (Total Revenue, Barbers Payment,
 * Running-cost, Total Income, and — for monthly — Monthly Expense +
 * Profit) for a single day/week/month, anchored at `referenceDate`.
 * Tries the pre-computed DailySummary table first (fast, one query);
 * falls back to a live aggregate over raw records when the summary
 * table can't fully cover the range (see getDailySummaryTotals).
 */
const computePeriodEntry = async (barberShopId, period, referenceDate) => {
  const { start, end } = getDateRange(period, referenceDate);

  const fromSummary = await getDailySummaryTotals(barberShopId, start, end);

  let totalRevenue, barbersPayment, runningCost;

  if (fromSummary) {
    ({ totalRevenue, barbersPayment, runningCost } = fromSummary);
  } else {
    const [logsTotals, runningCostTotal] = await Promise.all([
      aggregateServiceLogs(barberShopId, start, end),
      sumRunningCosts(barberShopId, start, end),
    ]);
    totalRevenue = logsTotals.totalRevenue;
    barbersPayment = logsTotals.barbersPayment;
    runningCost = runningCostTotal;
  }

  const totalIncome = totalRevenue - barbersPayment - runningCost;
  const entry = { start, end, totalRevenue, barbersPayment, runningCost, totalIncome };

  if (period === "monthly") {
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthlyExpense = await sumMonthlyExpenses(barberShopId, monthStart);
    entry.monthlyExpense = monthlyExpense;
    entry.profit = totalIncome - monthlyExpense;
  }

  return entry;
};

/**
 * Steps a reference date backward by `offset` periods, so offset=0 is the
 * current day/week/month, offset=1 is the previous one, etc.
 */
const getReferenceDate = (period, baseDate, offset) => {
  const d = new Date(baseDate);
  if (period === "daily") d.setDate(d.getDate() - offset);
  else if (period === "weekly") d.setDate(d.getDate() - offset * 7);
  else if (period === "monthly") d.setMonth(d.getMonth() - offset);
  return d;
};

const isEmptyEntry = (entry) =>
  entry.totalRevenue === 0 && entry.runningCost === 0 && !(entry.monthlyExpense > 0);

/**
 * GET /api/revenue?period=daily|weekly|monthly&date=YYYY-MM-DD
 * (admin only) — single period snapshot, kept for backward compatibility.
 */
const getRevenue = async (req, res, next) => {
  try {
    const { period = "daily", date } = req.query;

    if (!["daily", "weekly", "monthly"].includes(period)) {
      return res
        .status(400)
        .json({ message: "period must be daily, weekly, or monthly" });
    }

    const referenceDate = date ? new Date(date) : new Date();
    const barberShopId = new mongoose.Types.ObjectId(req.user.barberShop);
    const entry = await computePeriodEntry(barberShopId, period, referenceDate);

    res.json({ period, ...entry });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/revenue/history?period=daily|weekly|monthly&limit=N
 * (admin only)
 *
 * Returns the last N periods that actually have data, most recent first —
 * skips days/weeks/months with no activity instead of padding the list
 * with empty ones. Scans backward up to MAX_SCAN periods, in parallel
 * batches of SCAN_BATCH_SIZE, looking for `count` non-empty ones; if it
 * runs out, `reachedEnd: true` tells the frontend there's no more history
 * to load. Defaults: 14 days, 8 weeks, 6 months. Capped at 60 per request.
 */
const getRevenueHistory = async (req, res, next) => {
  try {
    const { period = "daily", limit } = req.query;

    if (!["daily", "weekly", "monthly"].includes(period)) {
      return res
        .status(400)
        .json({ message: "period must be daily, weekly, or monthly" });
    }

    const count = Math.min(
      Number(limit) || DEFAULT_HISTORY_LIMITS[period],
      MAX_HISTORY_LIMIT
    );
    const barberShopId = new mongoose.Types.ObjectId(req.user.barberShop);
    const now = new Date();

    const entries = [];
    let offset = 0;

    while (entries.length < count && offset < MAX_SCAN) {
      const batchOffsets = [];
      for (let i = 0; i < SCAN_BATCH_SIZE && offset + i < MAX_SCAN; i++) {
        batchOffsets.push(offset + i);
      }

      const batch = await Promise.all(
        batchOffsets.map((off) =>
          computePeriodEntry(barberShopId, period, getReferenceDate(period, now, off))
        )
      );

      for (const entry of batch) {
        if (!isEmptyEntry(entry)) entries.push(entry);
        if (entries.length >= count) break;
      }

      offset += batchOffsets.length;
    }

    res.json({ period, entries, reachedEnd: entries.length < count });
  } catch (err) {
    next(err);
  }
};

module.exports = { getRevenue, getRevenueHistory };
