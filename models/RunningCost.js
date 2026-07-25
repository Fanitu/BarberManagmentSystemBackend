const mongoose = require("mongoose");

const runningCostSchema = new mongoose.Schema(
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
    barberShop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BarberShop",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

runningCostSchema.index({ barberShop: 1, createdAt: -1 });

module.exports = mongoose.model("RunningCost", runningCostSchema);
