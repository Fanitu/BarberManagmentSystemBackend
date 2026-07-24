const mongoose = require("mongoose");

const barberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    // Day of week this barber gets paid out by the cron job.
    // 0 = Sunday ... 6 = Saturday
    paymentDay: {
      type: Number,
      min: 0,
      max: 6,
      default: 0,
    },
    barberShop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BarberShop",
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Barber", barberSchema);
