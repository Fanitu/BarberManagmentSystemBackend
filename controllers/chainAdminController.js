const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const ChainAdmin = require("../models/ChainAdmin");
const BarberShop = require("../models/BarberShop");
const ServiceLog = require("../models/ServiceLog");
const Service = require("../models/Service");
const RunningCost = require('../models/RunningCost');
const MonthlyExpense = require('../models/MonthlyExpense');
const Worker = require("../models/Worker");
const Debt = require("../models/Debt");
const Barber = require("../models/Barber");
const generateBarberCode = require("../utils/generateBarberCode");
const generateToken = require("../utils/generateToken");
const { getDateRange,startOfAddisMonth } = require("../utils/dateRanges");

const shopDailyOverview = async (shopId) => {
  const id = new mongoose.Types.ObjectId(shopId);
  const today = getDateRange("daily", new Date());
  const yesterday = getDateRange("daily", new Date(Date.now() - 24 * 60 * 60 * 1000));

  const [todayAgg, yesterdayAgg, barberAgg] = await Promise.all([
    ServiceLog.aggregate([
      { $match: { barberShop: id, createdAt: { $gte: today.start, $lte: today.end } } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]),
    ServiceLog.aggregate([
      { $match: { barberShop: id, createdAt: { $gte: yesterday.start, $lte: yesterday.end } } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]),
    ServiceLog.aggregate([
      { $match: { barberShop: id, createdAt: { $gte: today.start, $lte: today.end } } },
      { $group: { _id: "$barber", total: { $sum: "$price" } } },
      { $sort: { total: -1 } },
      { $limit: 1 },
      { $lookup: { from: "barbers", localField: "_id", foreignField: "_id", as: "barber" } },
      { $unwind: "$barber" },
    ]),
  ]);

  const todayRevenue = todayAgg[0]?.total || 0;
  const yesterdayRevenue = yesterdayAgg[0]?.total || 0;
  const changePercent =
    yesterdayRevenue > 0
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
      : todayRevenue > 0
      ? 100
      : 0;

  return {
    todayRevenue,
    yesterdayRevenue,
    changePercent,
    trend: todayRevenue >= yesterdayRevenue ? "up" : "down",
    bestBarber: barberAgg[0] ? { name: barberAgg[0].barber.name, revenue: barberAgg[0].total } : null,
  };
};

// GET /api/chainadmin/shops  (chain_admin only)
const listMyShops = async (req, res, next) => {
  try {
    const chainAdmin = await ChainAdmin.findById(req.user.id).populate("shops");
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const shops = await Promise.all(
      chainAdmin.shops.map(async (shop) => ({
        id: shop._id,
        name: shop.name,
        barberCode: shop.barberCode,
        isActive: shop.isActive,
        ...(await shopDailyOverview(shop._id)),
      }))
    );

    res.json({ shops });
  } catch (err) {
    next(err);
  }
};

// POST /api/chainadmin/shops  body: { name, ownerName, ownerPhone }
const createShop = async (req, res, next) => {
  try {
    const { name, ownerName, ownerPhone } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });

    let barberCode;
    let attempts = 0;
    while (attempts < 5) {
      barberCode = generateBarberCode();
      const exists = await BarberShop.findOne({ barberCode });
      if (!exists) break;
      attempts += 1;
    }

    const shop = await BarberShop.create({ name: name.trim(), ownerName, ownerPhone, barberCode });

    await ChainAdmin.findByIdAndUpdate(req.user.id, { $push: { shops: shop._id } });

    res.status(201).json(shop);
  } catch (err) {
    next(err);
  }
};

// POST /api/chainadmin/shops/:id/enter  (chain_admin only)
// Issues a shop-scoped "admin" session so the existing Admin UI works unmodified.
const enterShopView = async (req, res, next) => {
  try {
    const chainAdmin = await ChainAdmin.findById(req.user.id);
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const owns = chainAdmin.shops.some((s) => s.toString() === req.params.id);
    if (!owns) return res.status(403).json({ message: "You don't manage this shop" });

    const shop = await BarberShop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: "Barber shop not found" });

    const token = generateToken({ id: chainAdmin._id, role: "admin", barberShop: shop._id,viewingAsChainAdmin: true });
    const { setTokenCookie } = require("./authController");
    setTokenCookie(res, token);

    res.json({
      user: { id: chainAdmin._id, name: chainAdmin.name, role: "admin" },
      barberShop: { id: shop._id, name: shop.name },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/chainadmin/exit-shop-view  (any logged-in session whose id is a real ChainAdmin)
const exitShopView = async (req, res, next) => {
  try {
    const chainAdmin = await ChainAdmin.findById(req.user.id);
    if (!chainAdmin) return res.status(403).json({ message: "Not a chain admin session" });

    const token = generateToken({ id: chainAdmin._id, role: "chain_admin" });
    const { setTokenCookie } = require("./authController");
    setTokenCookie(res, token);

    res.json({ user: { id: chainAdmin._id, name: chainAdmin.name, role: "chain_admin" } });
  } catch (err) {
    next(err);
  }
};

const resolveTargetShops = async (req) => {
  const chainAdmin = await ChainAdmin.findById(req.user.id).populate("shops");
  if (!chainAdmin) return null;

  if (req.query.shopId && req.query.shopId !== "all") {
    const owns = chainAdmin.shops.some((s) => s._id.toString() === req.query.shopId);
    if (!owns) return [];
    return chainAdmin.shops.filter((s) => s._id.toString() === req.query.shopId);
  }
  return chainAdmin.shops;
};

// GET /api/chainadmin/reports?shopId=all|<id>&from=YYYY-MM-DD&to=YYYY-MM-DD&tab=revenue|barbers|services
const getReports = async (req, res, next) => {
  try {
    const { from, to, tab = "revenue" } = req.query;
    if (!from || !to) return res.status(400).json({ message: "from and to are required" });

    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const shops = await resolveTargetShops(req);
    if (shops === null) return res.status(404).json({ message: "Chain admin not found" });
    const shopIds = shops.map((s) => s._id);

    if (tab === "revenue") {
      const agg = await ServiceLog.aggregate([
        { $match: { barberShop: { $in: shopIds }, createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: "$barberShop",
            revenue: { $sum: "$price" },
            count: { $sum: 1 },
          },
        },
      ]);
      const byShop = new Map(agg.map((a) => [a._id.toString(), a]));

      const rows = shops.map((shop) => ({
        label: shop.name,
        barberCode: shop.barberCode,
        revenue: byShop.get(shop._id.toString())?.revenue || 0,
        count: byShop.get(shop._id.toString())?.count || 0,
      }));

      const total = rows.reduce((a, r) => a + r.revenue, 0);
      const top = rows.length ? rows.reduce((a, b) => (b.revenue > a.revenue ? b : a)) : null;

      return res.json({
        columns: [
          { key: "label", label: "Shop", type: "text" },
          { key: "revenue", label: "Revenue (Birr)", type: "number" , format: "currency" },
          { key: "count", label: "Transactions", type: "number", format: "count" },
        ],
        rows,
        summary: {
          total,
          average: rows.length ? Math.round(total / rows.length) : 0,
          top: top?.label || "—",
        },
      });
    }

    if (tab === "barbers") {
      const shopNameById = new Map(shops.map((s) => [s._id.toString(), s.name]));
      const agg = await ServiceLog.aggregate([
        { $match: { barberShop: { $in: shopIds }, createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: { barber: "$barber", shop: "$barberShop" },
            revenue: { $sum: "$price" },
            payout: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "unpaid"] },
                  { $multiply: ["$price", { $divide: [{ $subtract: [100, "$shopPercent"] }, 100] }] },
                  0,
                ],
              },
            },
          },
        },
        { $lookup: { from: "barbers", localField: "_id.barber", foreignField: "_id", as: "barber" } },
        { $unwind: "$barber" },
      ]);

      const rows = agg
        .map((a) => ({
          label: a.barber.name,
          shop: shopNameById.get(a._id.shop.toString()) || "Unknown",
          revenue: a.revenue,
          payout: Math.round(a.payout),
        }))
        .sort((x, y) => y.revenue - x.revenue);

      const total = rows.reduce((a, r) => a + r.revenue, 0);
      const top = rows.length ? rows.reduce((a, b) => (b.revenue > a.revenue ? b : a)) : null;

     return res.json({
        columns: [
          { key: "label", label: "Barber", type: "text" },
          { key: "shop", label: "Shop", type: "text" },
          { key: "revenue", label: "Revenue ", type: "number", format: "currency" },
          { key: "payout", label: "Payout Owed", type: "number", format: "currency" },
        ],
        rows,
        summary: {
          total,
          average: rows.length ? Math.round(total / rows.length) : 0,
          top: top?.label || "—",
        },
      });
    }

    // services
    const agg = await ServiceLog.aggregate([
      { $match: { barberShop: { $in: shopIds }, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: "$service", count: { $sum: 1 }, revenue: { $sum: "$price" } } },
      { $lookup: { from: "services", localField: "_id", foreignField: "_id", as: "service" } },
      { $unwind: "$service" },
    ]);

    const rows = agg
      .map((a) => ({ label: a.service.name, count: a.count, revenue: a.revenue }))
      .sort((x, y) => y.revenue - x.revenue);

    const total = rows.reduce((a, r) => a + r.revenue, 0);
    const top = rows.length ? rows.reduce((a, b) => (b.revenue > a.revenue ? b : a)) : null;

    res.json({
      columns: [
        { key: "label", label: "Service", type: "text" },
        { key: "count", label: "Count", type: "number", format: "count" },
        { key: "revenue", label: "Revenue", type: "number", format: "currency" },
      ],
      rows,
      summary: {
        total,
        average: rows.length ? Math.round(total / rows.length) : 0,
        top: top?.label || "—",
      },
    });
  } catch (err) {
    next(err);
  }
};

const computeShopEntry = async (shopId, period,referenceDate = new Date()) => {
  const { start, end } = getDateRange(period, referenceDate);
  const id = new mongoose.Types.ObjectId(shopId);

  const [logsAgg, runningCostAgg, bestBarberAgg] = await Promise.all([
    ServiceLog.aggregate([
      { $match: { barberShop: id, createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$price" },
          barbersPayment: {
            $sum: { $multiply: ["$price", { $divide: [{ $subtract: [100, "$shopPercent"] }, 100] }] },
          },
        },
      },
    ]),
    RunningCost.aggregate([
      { $match: { barberShop: id, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]),
    ServiceLog.aggregate([
      { $match: { barberShop: id, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: "$barber", total: { $sum: "$price" } } },
      { $sort: { total: -1 } },
      { $limit: 1 },
      { $lookup: { from: "barbers", localField: "_id", foreignField: "_id", as: "barber" } },
      { $unwind: "$barber" },
    ]),
  ]);

  const totalRevenue = logsAgg[0]?.totalRevenue || 0;
  const barbersPayment = logsAgg[0]?.barbersPayment || 0;
  const runningCost = runningCostAgg[0]?.total || 0;
  const totalIncome = totalRevenue - barbersPayment - runningCost;

  const entry = {
    start, end, totalRevenue, barbersPayment, runningCost, totalIncome,
    bestBarber: bestBarberAgg[0] ? { name: bestBarberAgg[0].barber.name, revenue: bestBarberAgg[0].total } : null,
  };

  if (period === "monthly") {
    const monthlyAgg = await MonthlyExpense.aggregate([
      {
        $match: {
          barberShop: id,
          month: { $lte: start },
          $or: [{ isActive: true }, { deactivatedAt: { $gte: start } }],
        },
      },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);
    entry.monthlyExpense = monthlyAgg[0]?.total || 0;
    entry.netProfit = totalIncome - entry.monthlyExpense;
  }

  return entry;
};

// GET /api/chainadmin/shops/revenue-overview?period=daily|weekly|monthly
const getShopsRevenueOverview = async (req, res, next) => {
  try {
    const { period = "daily" } = req.query;
    if (!["daily", "weekly", "monthly"].includes(period)) {
      return res.status(400).json({ message: "period must be daily, weekly, or monthly" });
    }

    const chainAdmin = await ChainAdmin.findById(req.user.id).populate("shops");
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const count = HISTORY_COUNTS[period];
    const now = new Date();
    const entries = [];

    for (let offset = 0; offset < count; offset++) {
      const referenceDate = getReferenceDate(period, now, offset);

      const shops = await Promise.all(
        chainAdmin.shops.map(async (shop) => ({
          id: shop._id,
          name: shop.name,
          barberCode: shop.barberCode,
          ...(await computeShopEntry(shop._id, period, referenceDate)),
        }))
      );

      const hasActivity = shops.some((s) => s.totalRevenue > 0);
      if (!hasActivity) continue;

      const { start, end } = getDateRange(period, referenceDate);
      entries.push({ label: formatPeriodLabel(period, start, end), start, end, shops });
    }

    res.json({ period, entries });
 } catch (err) {
    next(err);
 }
};

const computeBarberPayout = async (barberId, barberShop) => {
  const [logs, debts] = await Promise.all([
    ServiceLog.find({ barber: barberId, barberShop, status: "unpaid" }),
    Debt.find({ barber: barberId, barberShop, status: "unpaid" }),
  ]);
  const totalServicesGross = logs.reduce((sum, log) => sum + log.price, 0);
  const totalServicesIncome = logs.reduce(
    (sum, log) => sum + (log.price * (100 - log.shopPercent)) / 100,
    0
  );
  const debtAmount = debts.reduce((sum, d) => sum + d.amount, 0);
  const finalIncome = totalServicesIncome - debtAmount;

  return {
    totalServicesGross,
    totalServicesIncome,
    debtAmount,
    finalIncome,
    serviceLogIds: logs.map((l) => l._id),
    debtIds: debts.map((d) => d._id),
  };
};

  // GET /api/chainadmin/payouts/today
const listPayableBarbersToday = async (req, res, next) => {
  try {
    const chainAdmin = await ChainAdmin.findById(req.user.id).populate("shops");
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const todayWeekday = new Date().getDay();

    const grouped = await Promise.all(
      chainAdmin.shops.map(async (shop) => {
        const barbers = await Barber.find({
          barberShop: shop._id,
          paymentDay: todayWeekday,
          isActive: true,
        });

        const payouts = await Promise.all(
          barbers.map(async (barber) => ({
            barber: { id: barber._id, name: barber.name },
            ...(await computeBarberPayout(barber._id, shop._id)),
          }))
        );

        return {
          shop: { id: shop._id, name: shop.name },
          payouts: payouts.filter((p) => p.totalServicesGross > 0 || p.debtAmount > 0),
        };
      })
    );

    res.json(grouped.filter((g) => g.payouts.length > 0));
  } catch (err) {
    next(err);
  }
};

// POST /api/chainadmin/payouts/:barberId/pay
const payBarberNow = async (req, res, next) => {
 try {
    const chainAdmin = await ChainAdmin.findById(req.user.id);
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const barber = await Barber.findById(req.params.barberId);
    if (!barber) return res.status(404).json({ message: "Barber not found" });

    const owns = chainAdmin.shops.some((s) => s.toString() === barber.barberShop.toString());
    if (!owns) return res.status(403).json({ message: "You don't manage this barber's shop" });

    const payout = await computeBarberPayout(barber._id, barber.barberShop);
    const now = new Date();

    await Promise.all([
      ServiceLog.updateMany({ _id: { $in: payout.serviceLogIds } }, { status: "paid", paidAt: now }),
      Debt.updateMany({ _id: { $in: payout.debtIds } }, { status: "paid", paidAt: now }),
    ]);

    res.json({
      barber: { id: barber._id, name: barber.name },
      totalServicesGross: payout.totalServicesGross,
      totalServicesIncome: payout.totalServicesIncome,
      debtAmount: payout.debtAmount,
      finalIncome: payout.finalIncome,
      paidAt: now,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/chainadmin/payouts/history
const listPayoutHistory = async (req, res, next) => {
  try {
    const chainAdmin = await ChainAdmin.findById(req.user.id).populate("shops");
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const shopIds = chainAdmin.shops.map((s) => s._id);
    const shopNameById = new Map(chainAdmin.shops.map((s) => [s._id.toString(), s.name]));

    const events = await ServiceLog.aggregate([
      { $match: { barberShop: { $in: shopIds }, status: "paid" } },
      {
        $group: {
          _id: { barber: "$barber", paidAt: "$paidAt", shop: "$barberShop" },
          totalServicesGross: { $sum: "$price" },
          totalServicesIncome: {
            $sum: { $multiply: ["$price", { $divide: [{ $subtract: [100, "$shopPercent"] }, 100] }] },
          },
        },
      },
      { $lookup: { from: "barbers", localField: "_id.barber", foreignField: "_id", as: "barber" } },
      { $unwind: "$barber" },
      { $sort: { "_id.paidAt": -1 } },
      { $limit: 100 },
    ]);

    const debtSums = await Debt.aggregate([
      { $match: { barberShop: { $in: shopIds }, status: "paid" } },
      { $group: { _id: { barber: "$barber", paidAt: "$paidAt" }, debtAmount: { $sum: "$amount" } } },
    ]);
    const debtByKey = new Map(
      debtSums.map((d) => [`${d._id.barber}|${d._id.paidAt?.getTime()}`, d.debtAmount])
    );

    const rows = events.map((e) => {
      const key = `${e._id.barber}|${e._id.paidAt?.getTime()}`;
      const debtAmount = debtByKey.get(key) || 0;
      return {
        barber: { id: e._id.barber, name: e.barber.name },
        shop: { id: e._id.shop, name: shopNameById.get(e._id.shop.toString()) },
        paidAt: e._id.paidAt,
        totalServicesGross: e.totalServicesGross,
        totalServicesIncome: e.totalServicesIncome,
        debtAmount,
        finalIncome: e.totalServicesIncome - debtAmount,
      };
    });

    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/chainadmin/payouts/history/detail?barberId=&paidAt=
const getPayoutDetail = async (req, res, next) => {
  try {
    const { barberId, paidAt } = req.query;
    if (!barberId || !paidAt) {
      return res.status(400).json({ message: "barberId and paidAt are required" });
    }

    const chainAdmin = await ChainAdmin.findById(req.user.id);
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const barber = await Barber.findById(barberId);
    if (!barber || !chainAdmin.shops.some((s) => s.toString() === barber.barberShop.toString())) {
      return res.status(403).json({ message: "You don't manage this barber's shop" });
    }

    const exactPaidAt = new Date(paidAt);

    const [services, debts] = await Promise.all([
      ServiceLog.find({ barber: barberId, paidAt: exactPaidAt, status: "paid" }).populate("service", "name"),
      Debt.find({ barber: barberId, paidAt: exactPaidAt, status: "paid" }),
    ]);

    res.json({
      services: services.map((s) => ({
        id: s._id,
        serviceName: s.service?.name || "Unknown",
        price: s.price,
        income: (s.price * (100 - s.shopPercent)) / 100,
      })),
      debts: debts.map((d) => ({ id: d._id, amount: d.amount })),
    });
  } catch (err) {
    next(err);
  }
};

const HISTORY_COUNTS = { daily: 7, weekly: 7, monthly: 5 };

const computeIncomeHistory = async (shops, period) => {
  const count = HISTORY_COUNTS[period];
  const shopIds = shops.map((s) => s._id);
  const now = new Date();
  const entries = [];

  for (let offset = 0; offset < count; offset++) {
    const referenceDate = getReferenceDate(period, now, offset);
    const { start, end } = getDateRange(period, referenceDate);

    const agg = await ServiceLog.aggregate([
      { $match: { barberShop: { $in: shopIds }, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: "$barberShop", revenue: { $sum: "$price" } } },
   ]);
    const byShop = new Map(agg.map((a) => [a._id.toString(), a.revenue]));

    entries.push({
      start, end,
      shops: shops.map((s) => ({ name: s.name, revenue: byShop.get(s._id.toString()) || 0 })),
    });
  }

  return entries.filter((e) => e.shops.some((s) => s.revenue > 0)); //newest first escape older ones with no revenue
};

// GET /api/chainadmin/shops-detail/income?period=daily|weekly|monthly
const getShopsIncomeHistory = async (req, res, next) => {
  try {
    const { period = "daily" } = req.query;
    if (!["daily", "weekly", "monthly"].includes(period)) {
      return res.status(400).json({ message: "period must be daily, weekly, or monthly" });
    }
    const chainAdmin = await ChainAdmin.findById(req.user.id).populate("shops");
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const entries = await computeIncomeHistory(chainAdmin.shops, period);
    res.json({ period, entries });
  } catch (err) {
    next(err);
  }
};

const computeBarbersHistory = async (shops, period) => {
  const count = HISTORY_COUNTS[period];
  const shopIds = shops.map((s) => s._id);
  const now = new Date();
  const entries = [];

  for (let offset = 0; offset < count; offset++) {
    const referenceDate = getReferenceDate(period, now, offset);
    const { start, end } = getDateRange(period, referenceDate);

    const agg = await ServiceLog.aggregate([
      { $match: { barberShop: { $in: shopIds }, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { shop: "$barberShop", barber: "$barber" }, revenue: { $sum: "$price" } } },
      { $lookup: { from: "barbers", localField: "_id.barber", foreignField: "_id", as: "barber" } },
      { $unwind: "$barber" },
    ]);

   const byShop = new Map();
    for (const a of agg) {
      const key = a._id.shop.toString();
      if (!byShop.has(key)) byShop.set(key, []);
      byShop.get(key).push({ name: a.barber.name, revenue: a.revenue });
    }

    entries.push({
      start, end,
      shops: shops.map((s) => ({
        shopId: s._id,
        shopName: s.name,
        barbers: (byShop.get(s._id.toString()) || []).sort((x, y) => y.revenue - x.revenue),
      })),
    });
  }

  return entries
    .map((e) => ({ ...e, shops: e.shops.filter((s) => s.barbers.length > 0) }))
    .filter((e) => e.shops.length > 0); // newest first, drop shops/periods with no barber activity
};

// GET /api/chainadmin/shops-detail/barbers?period=daily|weekly|monthly
const getShopsBarbersHistory = async (req, res, next) => {
  try {
    const { period = "daily" } = req.query;
    if (!["daily", "weekly", "monthly"].includes(period)) {
      return res.status(400).json({ message: "period must be daily, weekly, or monthly" });
    }
    const chainAdmin = await ChainAdmin.findById(req.user.id).populate("shops");
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const entries = await computeBarbersHistory(chainAdmin.shops, period);
    res.json({ period, entries });
  } catch (err) {
    next(err);
  }
};

// GET /api/chainadmin/shops-detail/monthly-expense
const getShopsMonthlyExpense = async (req, res, next) => {
  try {
    const chainAdmin = await ChainAdmin.findById(req.user.id).populate("shops");
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const monthStart = getDateRange("monthly", new Date()).start;

    const shops = await Promise.all(
      chainAdmin.shops.map(async (shop) => {
       const agg = await MonthlyExpense.aggregate([
          {
            $match: {
              barberShop: shop._id,
              month: { $lte: monthStart },
              $or: [{ isActive: true }, { deactivatedAt: { $gte: monthStart } }],
            },
          },
          { $group: { _id: null, total: { $sum: "$price" } } },
        ]);
        return { name: shop.name, expense: agg[0]?.total || 0 };
      })
    );

    res.json({ shops:shops.filter((s) => s.expense > 0) });
  } catch (err) {
    next(err);
  }
};

const getReferenceDate = (period, baseDate, offset) => {
  const d = new Date(baseDate);
  if (period === "daily") d.setDate(d.getDate() - offset);
  else if (period === "weekly") d.setDate(d.getDate() - offset * 7);
  else if (period === "monthly") d.setMonth(d.getMonth() - offset);
  return d;
};

// GET /api/chainadmin/barbers
const listAllBarbers = async (req, res, next) => {
  try {
    const chainAdmin = await ChainAdmin.findById(req.user.id).populate("shops");
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const grouped = await Promise.all(
      chainAdmin.shops.map(async (shop) => ({
        shop: { id: shop._id, name: shop.name },
        barbers: await Barber.find({ barberShop: shop._id }).sort({ name: 1 }),
      }))
    );

    res.json(grouped);
  } catch (err) {
    next(err);
  }
};

const assertOwnsBarber = async (chainAdminId, barberId) => {
  const chainAdmin = await ChainAdmin.findById(chainAdminId);
  const barber = await Barber.findById(barberId);
  if (!chainAdmin || !barber) return null;
  const owns = chainAdmin.shops.some((s) => s.toString() === barber.barberShop.toString());
  return owns ? barber : null;
};

// POST /api/chainadmin/barbers  body: { shopId, name, phone, paymentDay }
const createBarberForShop = async (req, res, next) => {
  try {
    const { shopId, name, phone, paymentDay } = req.body;
    if (!shopId || !name) {
      return res.status(400).json({ message: "shopId and name are required" });
    }
    if (!(await assertOwnsShop(req.user.id, shopId))) {
      return res.status(403).json({ message: "You don't manage this shop" });
    }

    const barber = await Barber.create({
      name: name.trim(),
      phone,
      paymentDay: paymentDay ?? 0,
      barberShop: shopId,
    });

    res.status(201).json(barber);
  } catch (err) {
    next(err);
  }
};

// PUT /api/chainadmin/barbers/:id  body: { name, phone, paymentDay }
const updateBarber = async (req, res, next) => {
  try {
    const barber = await assertOwnsBarber(req.user.id, req.params.id);
    if (!barber) return res.status(403).json({ message: "You don't manage this barber" });

    const { name, phone, paymentDay } = req.body;
    if (name !== undefined) barber.name = name.trim();
    if (phone !== undefined) barber.phone = phone;
    if (paymentDay !== undefined) barber.paymentDay = paymentDay;
    await barber.save();

    res.json(barber);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/chainadmin/barbers/:id
const deleteBarber = async (req, res, next) => {
  try {
    const barber = await assertOwnsBarber(req.user.id, req.params.id);
    if (!barber) return res.status(403).json({ message: "You don't manage this barber" });

      await Barber.deleteOne({ _id: barber._id });
    res.json({ message: "Barber deleted" });
  } catch (err) {
    next(err);
  }
};

// GET /api/chainadmin/workers
const listAllWorkers = async (req, res, next) => {
  try {
    const chainAdmin = await ChainAdmin.findById(req.user.id).populate("shops");
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const grouped = await Promise.all(
      chainAdmin.shops.map(async (shop) => ({
        shop: { id: shop._id, name: shop.name },
        workers: await Worker.find({ barberShop: shop._id }).select("-password").sort({ name: 1 }),
      }))
    );

    res.json(grouped);
  } catch (err) {
    next(err);
  }
};

const assertOwnsWorker = async (chainAdminId, workerId) => {
  const chainAdmin = await ChainAdmin.findById(chainAdminId);
  const worker = await Worker.findById(workerId);
  if (!chainAdmin || !worker) return null;
  const owns = chainAdmin.shops.some((s) => s.toString() === worker.barberShop.toString());
  return owns ? worker : null;
};

// PATCH /api/chainadmin/workers/:id/deactivate
const deactivateWorker = async (req, res, next) => {
  try {
    const worker = await assertOwnsWorker(req.user.id, req.params.id);
    if (!worker) return res.status(403).json({ message: "You don't manage this worker" });

    worker.isActive = false;
    await worker.save();
    res.json({ id: worker._id, isActive: false });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/chainadmin/workers/:id/activate
const activateWorker = async (req, res, next) => {
  try {
    const worker = await assertOwnsWorker(req.user.id, req.params.id);
    if (!worker) return res.status(403).json({ message: "You don't manage this worker" });

    worker.isActive = true;
    await worker.save();
    res.json({ id: worker._id, isActive: true });
  } catch (err) {
    next(err);
  }
};


// DELETE /api/chainadmin/workers/:id
const deleteWorker = async (req, res, next) => {
  try {
    const worker = await assertOwnsWorker(req.user.id, req.params.id);
    if (!worker) return res.status(403).json({ message: "You don't manage this worker" });

    await Worker.deleteOne({ _id: worker._id });
    res.json({ message: "Worker deleted" });
  } catch (err) {
    next(err);
  }
};


const computeShopsProgress = async (shops, period) => {
  const count = HISTORY_COUNTS[period];
  const now = new Date();

  const perShop = await Promise.all(
    shops.map(async (shop) => {
      const points = [];
      for (let offset = count - 1; offset >= 0; offset--) {
        const referenceDate = getReferenceDate(period, now, offset);
        const { start, end } = getDateRange(period, referenceDate);

        const agg = await ServiceLog.aggregate([
          { $match: { barberShop: shop._id, createdAt: { $gte: start, $lte: end } } },
          { $group: { _id: null, revenue: { $sum: "$price" } } },
        ]);

        points.push({
          label: formatPeriodLabel(period, start, end),
          start, end,
          revenue: agg[0]?.revenue || 0,
        });
      }
      return { id: shop._id, name: shop.name, points };
    })
  );

  return perShop;
};

const formatPeriodLabel = (period, start, end) => {
  if (period === "daily") {
    return start.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  }
  if (period === "weekly") {
    const s = start.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    const e = end.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    return `${s} – ${e}`;
  }
  return start.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

// GET /api/chainadmin/shops-progress?period=daily|weekly|monthly
const getShopsProgress = async (req, res, next) => {
  try {
    const { period = "daily" } = req.query;
    if (!["daily", "weekly", "monthly"].includes(period)) {
      return res.status(400).json({ message: "period must be daily, weekly, or monthly" });
    }
    const chainAdmin = await ChainAdmin.findById(req.user.id).populate("shops");
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const shops = await computeShopsProgress(chainAdmin.shops, period);
    res.json({ period, shops });
  } catch (err) {
    next(err);
  }
};

// GET /api/chainadmin/running-costs — past 7 days, grouped by date then shop
const listRunningCosts = async (req, res, next) => {
  try {
    const chainAdmin = await ChainAdmin.findById(req.user.id).populate("shops");
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

   const shopIds = chainAdmin.shops.map((s) => s._id);
    const shopNameById = new Map(chainAdmin.shops.map((s) => [s._id.toString(), s.name]));

    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const costs = await RunningCost.find({
      barberShop: { $in: shopIds },
      createdAt: { $gte: since },
    }).sort({ createdAt: -1 });
    const byDate = new Map();
    for (const cost of costs) {
      const dateKey = cost.createdAt.toISOString().slice(0, 10);
      if (!byDate.has(dateKey)) byDate.set(dateKey, new Map());
      const shopKey = cost.barberShop.toString();
      const dayShops = byDate.get(dateKey);
      if (!dayShops.has(shopKey)) {
        dayShops.set(shopKey, { shopId: shopKey, shopName: shopNameById.get(shopKey) || "Unknown", costs: [] });
      }
      dayShops.get(shopKey).costs.push({ id: cost._id, name: cost.name, price: cost.price });
    }

    const entries = Array.from(byDate.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, shopsMap]) => ({ date, shops: Array.from(shopsMap.values()) }));

    res.json({ entries });
  } catch (err) {
    next(err);
  }
};


// POST /api/chainadmin/running-costs  body: { shopId, name, price }
const createRunningCost = async (req, res, next) => {
  try {
    const { shopId, name, price } = req.body;
    if (!shopId || !name || price == null) {
      return res.status(400).json({ message: "shopId, name and price are required" });
    }
    const chainAdmin = await ChainAdmin.findById(req.user.id);
    if (!chainAdmin.shops.some((s) => s.toString() === shopId)) {
      return res.status(403).json({ message: "You don't manage this shop" });
    }
    const cost = await RunningCost.create({ name: name.trim(), price, barberShop: shopId });
    res.status(201).json(cost);
  } catch (err) {
    next(err);
  }
};

// GET /api/chainadmin/monthly-expenses — grouped by shop, current month only
const listMonthlyExpenses = async (req, res, next) => {
  try {
    const chainAdmin = await ChainAdmin.findById(req.user.id).populate("shops");
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const grouped = await Promise.all(
      chainAdmin.shops.map(async (shop) => {
        const expenses = await MonthlyExpense.find({
          barberShop: shop._id,
          isActive: true,
        }).sort({ month: -1, createdAt: -1 });
        return {
          shopId: shop._id,
          shopName: shop.name,
          expenses: expenses.map((e) => ({ id: e._id, name: e.name, price: e.price })),
        };
      })
    );
    console.log("grouped monthly expenses:", grouped);

    res.json({ shops: grouped.filter((g) => g.expenses.length > 0) });
  } catch (err) {
    next(err);
  }
};

// POST /api/chainadmin/monthly-expenses  body: { shopId, name, price }
const createMonthlyExpense = async (req, res, next) => {
  try {
    const { shopId, name, price } = req.body;
    if (!shopId || !name || price == null) {
      return res.status(400).json({ message: "shopId, name and price are required" });
    }
    const chainAdmin = await ChainAdmin.findById(req.user.id);
    if (!chainAdmin.shops.some((s) => s.toString() === shopId)) {
      return res.status(403).json({ message: "You don't manage this shop" });
    }

    const expense = await MonthlyExpense.create({
      name: name.trim(), price, barberShop: shopId, month: startOfAddisMonth()
    });
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
};


// PUT /api/chainadmin/monthly-expenses/:id  body: { name, price }
const updateMonthlyExpense = async (req, res, next) => {
  try {

    const { name, price } = req.body;
   if (!name && price == null) {
      return res.status(400).json({ message: "name or price is required" });
    }

    const existing = await assertOwnsMonthlyExpense(req.user.id, req.params.id);
    if (!existing || !existing.isActive) {
      return res.status(404).json({ message: "Monthly expense not found" });
    }

    const currentMonthStart = startOfAddisMonth();

    // Created this same month -> nothing historical to protect, edit in place.
    if (existing.month.getTime() === currentMonthStart.getTime()) {
      if (name) existing.name = name.trim();
      if (price != null) existing.price = price;
      await existing.save();
      return res.json(existing);
    }

    // Otherwise: close out the old version as of end of last month...
    existing.isActive = false;
    existing.deactivatedAt = new Date(currentMonthStart.getTime() - 1);
    await existing.save();

    // ...and open a new version, starting this month, with the update applied.
    const updated = await MonthlyExpense.create({
    name: name ? name.trim() : existing.name,
      price: price != null ? price : existing.price,
      month: currentMonthStart,
      barberShop: existing.barberShop,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/chainadmin/monthly-expenses/:id
// Soft-deletes — keeps past months' totals intact (see computeShopEntry).
const deleteMonthlyExpense = async (req, res, next) => {
  try {
    const expense = await assertOwnsMonthlyExpense(req.user.id, req.params.id);
   if (!expense || !expense.isActive) {
      return res.status(404).json({ message: "Monthly expense not found" });
    }

    expense.isActive = false;
    expense.deactivatedAt = new Date();
    await expense.save();

    res.json({ message: "Monthly expense removed" });
  } catch (err) {
    next(err);
  }
};


// PATCH /api/chainadmin/settings/email-analysis  body: { enabled }
const setEmailAnalysisEnabled = async (req, res, next) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ message: "enabled must be true or false" });
    }
    const chainAdmin = await ChainAdmin.findByIdAndUpdate(
      req.user.id,
      { emailAnalysisEnabled: enabled },
      { new: true }
    );
    res.json({ emailAnalysisEnabled: chainAdmin.emailAnalysisEnabled });
  } catch (err) {
    next(err);
  }
};

// GET /api/chainadmin/settings
const getSettings = async (req, res, next) => {
  try {
 const chainAdmin = await ChainAdmin.findById(req.user.id)
      .select("emailAnalysisEnabled email telegramAnalysisEnabled telegramPhone telegramChatId");
    res.json({
      emailAnalysisEnabled: chainAdmin.emailAnalysisEnabled,
      email: chainAdmin.email,
      telegramAnalysisEnabled: chainAdmin.telegramAnalysisEnabled,
      telegramPhone: chainAdmin.telegramPhone || null,
      telegramConnected: !!chainAdmin.telegramChatId,
    });
} catch (err) {
    next(err);
  }
};

const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

/**
 * Builds the Overall Profit breakdown for one shop, one calendar month.
 * For the current, still-running month, monthly expense is prorated to
 * the days elapsed so far; revenue/barbers-payment/running-cost are not
 * prorated since they're real logged data — future days naturally
 * contribute 0 since no records exist for them yet.
 */
const computeMonthlyProfitEntry = async (shopId, referenceDate) => {
  const { start, end } = getDateRange("monthly", referenceDate);
  const id = new mongoose.Types.ObjectId(shopId);

  const now = new Date();
  const isCurrentMonth = referenceDate.getFullYear() === now.getFullYear() && referenceDate.getMonth() === now.getMonth();
  const totalDays = daysInMonth(referenceDate.getFullYear(), referenceDate.getMonth());
  const daysElapsed = isCurrentMonth ? now.getDate() : totalDays;
  const isFinished = !isCurrentMonth;
  const [logsAgg, runningCostAgg, monthlyExpenseAgg] = await Promise.all([
    ServiceLog.aggregate([
      { $match: { barberShop: id, createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$price" },
          barbersPayment: {
            $sum: { $multiply: ["$price", { $divide: [{ $subtract: [100, "$shopPercent"] }, 100] }] },
          },
        },
      },
    ]),
    RunningCost.aggregate([
      { $match: { barberShop: id, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]),
    MonthlyExpense.aggregate([
      {
        $match: {
          barberShop: id,
          month: { $lte: start },
          $or: [{ isActive: true }, { deactivatedAt: { $gte: start } }],
        },
      },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]),
  ]);
  
  const totalRevenue = logsAgg[0]?.totalRevenue || 0;
  const barbersPayment = logsAgg[0]?.barbersPayment || 0;
  const runningCost = runningCostAgg[0]?.total || 0;
  const monthlyExpenseFull = monthlyExpenseAgg[0]?.total || 0;
  const monthlyExpenseDisplayed = isFinished
    ? monthlyExpenseFull
    : Math.round((monthlyExpenseFull / totalDays) * daysElapsed);

  const totalIncome = totalRevenue - barbersPayment;
  const grossProfit = totalIncome - runningCost - monthlyExpenseDisplayed;

  return {
    year: referenceDate.getFullYear(),
    month: referenceDate.getMonth(),
    totalDays,
    daysElapsed,
    daysLeft: totalDays - daysElapsed,
    isFinished,
    totalRevenue,
    barbersPayment,
    runningCost,
    monthlyExpenseFull,
    monthlyExpenseDisplayed,
    totalIncome,
    grossProfit,
  };
};

// GET /api/chainadmin/overall-profit?monthsBack=12
const getOverallProfit = async (req, res, next) => {
  try {
    const monthsBack = Math.min(Number(req.query.monthsBack) || 12, 24);
   const chainAdmin = await ChainAdmin.findById(req.user.id).populate("shops");
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const now = new Date();
    const months = [];

    for (let offset = 0; offset < monthsBack; offset++) {
      const referenceDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);

      const shops = await Promise.all(
        chainAdmin.shops.map(async (shop) => ({
          id: shop._id,
          name: shop.name,
          ...(await computeMonthlyProfitEntry(shop._id, referenceDate)),
        }))
      );

      const hasAnyData = shops.some((s) => s.totalRevenue > 0 || s.runningCost > 0 || s.monthlyExpenseFull > 0);
      if (!hasAnyData) continue; // "leave it if we don't have data"

      months.push({
        label: referenceDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        year: referenceDate.getFullYear(),
        month: referenceDate.getMonth(),
        isFinished: shops[0]?.isFinished ?? true,
        daysElapsed: shops[0]?.daysElapsed,
        daysLeft: shops[0]?.daysLeft,
        shops,
      });
    }

    res.json({ months });
  } catch (err) {
    next(err);
  }
};

// GET /api/chainadmin/services — grouped by shop
const listAllServices = async (req, res, next) => {
  try {
    const chainAdmin = await ChainAdmin.findById(req.user.id).populate("shops");
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const grouped = await Promise.all(
      chainAdmin.shops.map(async (shop) => ({
        shop: { id: shop._id, name: shop.name },
        services: await Service.find({ barberShop: shop._id, isActive: true }).sort({ name: 1 }),
      }))
    );

    res.json(grouped);
  } catch (err) {
    next(err);
  }
};

const assertOwnsShop = async (chainAdminId, shopId) => {
  const chainAdmin = await ChainAdmin.findById(chainAdminId);
  return chainAdmin && chainAdmin.shops.some((s) => s.toString() === shopId);
};

// POST /api/chainadmin/services  body: { shopId, name, price, shopPercent }
const createShopService = async (req, res, next) => {
  try {
    const { shopId, name, price, shopPercent } = req.body;
    if (!shopId || !name || price == null || shopPercent == null) {
      return res.status(400).json({ message: "shopId, name, price and shopPercent are required" });
    }
    if (!(await assertOwnsShop(req.user.id, shopId))) {
      return res.status(403).json({ message: "You don't manage this shop" });
    }

    const service = await Service.create({
      name: name.trim(),
      price,
      shopPercent,
      barberShop: shopId,
    });

    res.status(201).json(service);
  } catch (err) {
    next(err);
  }
};

const assertOwnsService = async (chainAdminId, serviceId) => {
  const service = await Service.findById(serviceId);
  if (!service) return null;
  const owns = await assertOwnsShop(chainAdminId, service.barberShop.toString());
  return owns ? service : null;
};

// PUT /api/chainadmin/services/:id  body: { name, price, shopPercent }
const updateShopService = async (req, res, next) => {
  try {
   const service = await assertOwnsService(req.user.id, req.params.id);
    if (!service) return res.status(403).json({ message: "You don't manage this service" });

    const { name, price, shopPercent } = req.body;
    if (name !== undefined) service.name = name.trim();
    if (price !== undefined) service.price = price;
    if (shopPercent !== undefined) service.shopPercent = shopPercent;
    await service.save();

    res.json(service);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/chainadmin/services/:id
const deleteShopService = async (req, res, next) => {
  try {
    const service = await assertOwnsService(req.user.id, req.params.id);
    if (!service) return res.status(403).json({ message: "You don't manage this service" });

    await Service.deleteOne({ _id: service._id });
    res.json({ message: "Service deleted" });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/chainadmin/settings/password  body: { previousPassword, newPassword }
const changeChainAdminPassword = async (req, res, next) => {
  console.log("changeChainAdminPassword called with body:", req.body);
  try {
    const { previousPassword, newPassword } = req.body;
    if (!previousPassword || !newPassword) {
      return res.status(400).json({ message: "previousPassword and newPassword are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const chainAdmin = await ChainAdmin.findById(req.user.id);
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    const match = await bcrypt.compare(previousPassword, chainAdmin.password);
    if (!match) {
      return res.status(401).json({ message: "Previous password is incorrect" });
    }

    chainAdmin.password = await bcrypt.hash(newPassword, 10);
    await chainAdmin.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
};


// PATCH /api/chainadmin/settings/telegram-phone  body: { phone }
// Saves the phone number and flips the feature on; chat id is filled in
// later once the user shares their contact with the bot.
const saveTelegramPhone = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "phone is required" });

    const normalized = phone.replace(/\s+/g, "");
   await ChainAdmin.findByIdAndUpdate(req.user.id, {
      telegramPhone: normalized,
      telegramAnalysisEnabled: true,
    });

    res.json({ message: "Phone saved" });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/chainadmin/settings/telegram-analysis  body: { enabled }
const setTelegramAnalysisEnabled = async (req, res, next) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
     return res.status(400).json({ message: "enabled must be true or false" });
    }
    const chainAdmin = await ChainAdmin.findByIdAndUpdate(
      req.user.id,
      { telegramAnalysisEnabled: enabled },
      { new: true }
    );
    res.json({ telegramAnalysisEnabled: chainAdmin.telegramAnalysisEnabled });
  } catch (err) {
    next(err);
  }
};

const assertOwnsMonthlyExpense = async (chainAdminId, expenseId) => {
  const expense = await MonthlyExpense.findById(expenseId);
  if (!expense) return null;
 const owns = await assertOwnsShop(chainAdminId, expense.barberShop.toString());
  return owns ? expense : null;
};



module.exports = { listMyShops, createShop, enterShopView, exitShopView,getReports,getShopsRevenueOverview,listPayableBarbersToday, payBarberNow, listPayoutHistory, getPayoutDetail,getShopsIncomeHistory,getShopsBarbersHistory,getShopsMonthlyExpense, createBarberForShop,listAllBarbers, updateBarber, deleteBarber, listAllWorkers,activateWorker, deactivateWorker, deleteWorker,getShopsProgress, setEmailAnalysisEnabled, getSettings,computeShopEntry ,listRunningCosts, createRunningCost, listMonthlyExpenses, createMonthlyExpense,getOverallProfit, listAllServices, createShopService, updateShopService, deleteShopService, changeChainAdminPassword ,saveTelegramPhone, setTelegramAnalysisEnabled, updateMonthlyExpense, deleteMonthlyExpense };