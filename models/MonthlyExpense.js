const mongoose = require("mongoose");
const { startOfAddisMonth } = require("../utils/dateRanges");

const monthlyExpenseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    month: {
      type: Date,
      required: true,
      default: () => startOfAddisMonth(),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
    barberShop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BarberShop",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MonthlyExpense", monthlyExpenseSchema);