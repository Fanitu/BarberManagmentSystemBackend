const mongoose = require("mongoose");

const barberShopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    barberCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    ownerName: {
      type: String,
      trim: true,
    },
    ownerPhone: {
      type: String,
      trim: true,
    },
    ownerEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    subscriptionStatus: {
      type: String,
      enum: ["trial", "paid"],
      default: "trial",
    },
    trialEndsAt: {
      type: Date,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly", null],
      default: null,
    },
    nextPaymentDue: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BarberShop", barberShopSchema);
