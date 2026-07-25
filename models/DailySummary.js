const mongoose = require("mongoose");

const DailySummarySchema = new mongoose.Schema({
  barberShop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BarberShop",
    required: true,
    index: true,
  },
  date: {
    type: Date,
    required: true,
    index: true,
  },
  totalRevenue: {
    type: Number,
    default: 0,
  },
  barbersPayment: {
    type: Number,
    default: 0,
  },
  runningCost: {
    type: Number,
    default: 0,
  },
  totalIncome: {
    type: Number,
    default: 0,
  },
  orderCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for faster lookups
DailySummarySchema.index({ barberShop: 1, date: -1 });

module.exports = mongoose.model("DailySummary", DailySummarySchema);