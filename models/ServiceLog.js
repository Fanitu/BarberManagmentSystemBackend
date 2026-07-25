const mongoose = require("mongoose");

const serviceLogSchema = new mongoose.Schema(
  {
    barber: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barber",
      required: true,
      index: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    // Price actually charged for this transaction (worker-entered,
    // usually equal to the service's catalog price at time of entry).
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    // Snapshot of the shop's cut percentage at the time of the transaction,
    // so later edits to the Service catalog don't rewrite past payouts.
    shopPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
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

serviceLogSchema.index({ barberShop: 1, createdAt: -1 });

module.exports = mongoose.model("ServiceLog", serviceLogSchema);
