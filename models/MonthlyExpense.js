const mongoose = require("mongoose");

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
    // First day of the month this expense belongs to, e.g. 2026-07-01.
    // Defaults to the first of the current month at creation time.
    month: {
      type: Date,
      required: true,
      default: () => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
      },
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

monthlyExpenseSchema.index({ barberShop: 1, month: -1 });

module.exports = mongoose.model("MonthlyExpense", monthlyExpenseSchema);
