const mongoose = require("mongoose");
const ServiceLog = require("../models/ServiceLog");
const RunningCost = require("../models/RunningCost");
const MonthlyExpense = require("../models/MonthlyExpense");
const { getDateRange } = require("../utils/dateRanges");

const DEFAULT_HISTORY_LIMITS = { daily: 14, weekly: 8, monthly: 6 };
const MAX_HISTORY_LIMIT = 6;

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
 * Computes the full metadata set (Total Revenue, Barbers Payment,
 * Running-cost, Total Income, and — for monthly — Monthly Expense +
 * Profit) for a single day/week/month, anchored at `referenceDate`.
 */
const computePeriodEntry = async (barberShopId, period, referenceDate) => {
  const { start, end } = getDateRange(period, referenceDate);

  const [{ totalRevenue, barbersPayment }, runningCost] = await Promise.all([
    aggregateServiceLogs(barberShopId, start, end),
    sumRunningCosts(barberShopId, start, end),
  ]);

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
 * Returns the last N periods, most recent first — one full metadata set
 * per day/week/month, for a list view instead of a single snapshot.
 * Defaults: 14 days, 8 weeks, 6 months. Capped at 60 entries per request.
 */

 const MAX_SCAN = 5;

 const isEmptyEntry = (entry) =>
   entry.totalRevenue === 0 && entry.runningCost === 0 && !(entry.monthlyExpense > 0);


const getRevenueHistory = async (req, res, next) => {
  try {
    const { period = "daily", limit } = req.query;
    console.log("period:", period, "limit:", limit);

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
     const entry = await computePeriodEntry(
       barberShopId,
       period,
       getReferenceDate(period, now, offset)
     );
     console.log(`offset: ${offset}, entry:`, entry);
     if (!isEmptyEntry(entry)) entries.push(entry);
     offset += 1;
  }

   res.json({ period, entries, reachedEnd: entries.length < count });
  } catch (err) {
    next(err);
  }
};

module.exports = { getRevenue, getRevenueHistory };
