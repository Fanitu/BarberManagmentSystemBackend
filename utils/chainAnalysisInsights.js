const mongoose = require("mongoose");
const Barber = require("../models/Barber");
const Service = require("../models/Service");
const ServiceLog = require("../models/ServiceLog");

const getBarberBreakdown = async (shopId, start, end) => {
  const agg = await ServiceLog.aggregate([
    { $match: { barberShop: new mongoose.Types.ObjectId(shopId), createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: "$barber", revenue: { $sum: "$price" } } },
  ]);
  const activeBarbers = await Barber.find({ barberShop: shopId, isActive: true }).select("name");
  const revenueByBarber = new Map(agg.map((a) => [a._id.toString(), a.revenue]));
  return activeBarbers.map((b) => ({ name: b.name, revenue: revenueByBarber.get(b._id.toString()) || 0 }));
};

const getUnservedServiceNames = async (shopId, start, end) => {
  const servedIds = await ServiceLog.distinct("service", {
    barberShop: shopId,
    createdAt: { $gte: start, $lte: end },
  });
  const servedSet = new Set(servedIds.map((id) => id.toString()));
  const catalog = await Service.find({ barberShop: shopId, isActive: true }).select("name");
  return catalog.filter((s) => !servedSet.has(s._id.toString())).map((s) => s.name);
};

const periodWord = (period) => (period === "daily" ? "day" : period === "weekly" ? "week" : "month");

const buildShopInsight = async (shop, period, start, end, currentRevenue, previousRevenue) => {
  const lines = [];

  if (currentRevenue === 0) {
    lines.push(`${shop.name} had no recorded activity this ${periodWord(period)}.`);
  } else if (previousRevenue > 0) {
    const changePercent = Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100);
    if (changePercent <= -15) {
      lines.push(`${shop.name} is slowing down — revenue dropped ${Math.abs(changePercent)}% compared to the previous ${periodWord(period)}.`);
    } else if (changePercent >= 15) {
      lines.push(`${shop.name} is picking up — revenue grew ${changePercent}% compared to the previous ${periodWord(period)}.`);
    }
  }

  const barbers = await getBarberBreakdown(shop._id, start, end);
  const idleBarbers = barbers.filter((b) => b.revenue === 0);
  if (idleBarbers.length > 0) {
    lines.push(`${idleBarbers.map((b) => b.name).join(", ")} had no services logged at ${shop.name}.`);
  }
  const activeBarbers = barbers.filter((b) => b.revenue > 0);
  if (activeBarbers.length > 1) {
    const avg = activeBarbers.reduce((s, b) => s + b.revenue, 0) / activeBarbers.length;
    const lowPerformers = activeBarbers.filter((b) => b.revenue < avg * 0.5);
    if (lowPerformers.length > 0) {
      lines.push(`${lowPerformers.map((b) => b.name).join(", ")} performed well below ${shop.name}'s average — worth checking in with them.`);
    }
  }

  const unserved = await getUnservedServiceNames(shop._id, start, end);
  if (unserved.length > 0) {
    lines.push(`${shop.name} didn't sell: ${unserved.join(", ")} — consider promoting these or reviewing if they're still relevant.`);
  }

  return lines;
};

module.exports = { getBarberBreakdown, getUnservedServiceNames, buildShopInsight };