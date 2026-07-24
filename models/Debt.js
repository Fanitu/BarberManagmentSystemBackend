const mongoose = require("mongoose");

const debtSchema = new mongoose.Schema(
  {
    barber: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barber",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
      index: true,
    },
    paidAt: {
      type: Date,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: true,
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

module.exports = mongoose.model("Debt", debtSchema);
