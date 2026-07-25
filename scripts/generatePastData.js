const mongoose = require("mongoose");
require("dotenv").config();

// Import your models
const DailySummary = require("../models/DailySummary");
const ServiceLog = require("../models/ServiceLog");
const RunningCost = require("../models/RunningCost");
const BarberShop = require("../models/BarberShop");

async function generateDailySummary(barberShopId, date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  // Get all service logs for this day
  const serviceData = await ServiceLog.aggregate([
    {
      $match: {
        barberShop: barberShopId,
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
        orderCount: { $sum: 1 },
      },
    },
  ]);

  // Get running costs for this day
  const runningCost = await RunningCost.aggregate([
    {
      $match: {
        barberShop: barberShopId,
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$price" },
      },
    },
  ]);

  const revenue = serviceData[0] || { totalRevenue: 0, barbersPayment: 0, orderCount: 0 };
  const runningCostTotal = runningCost[0]?.total || 0;
  const totalIncome = revenue.totalRevenue - revenue.barbersPayment - runningCostTotal;

  // Upsert the daily summary
  await DailySummary.updateOne(
    { barberShop: barberShopId, date: start },
    {
      $set: {
        totalRevenue: revenue.totalRevenue,
        barbersPayment: revenue.barbersPayment,
        runningCost: runningCostTotal,
        totalIncome: totalIncome,
        orderCount: revenue.orderCount,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  console.log(`✅ Generated for ${start.toISOString().split('T')[0]}`);
}

async function generateAllPastData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || "your-mongodb-uri-here");
    console.log("✅ Connected to MongoDB");

    // Get all barbershops
    const barberShops = await BarberShop.find({}, '_id');
    console.log(`📊 Found ${barberShops.length} barbershops`);

    // Generate for the last 90 days (or however many days you have data)
    const daysToGenerate = 90; // Change this to how many days of data you have
    
    for (let i = 0; i < daysToGenerate; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      console.log(`📅 Processing ${date.toISOString().split('T')[0]}...`);
      
      for (const shop of barberShops) {
        await generateDailySummary(shop._id, date);
      }
    }

    console.log("🎉 All past data generated successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

generateAllPastData();