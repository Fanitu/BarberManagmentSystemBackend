const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
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
    // Percentage of the service price that the shop keeps.
    // The barber's cut is (100 - shopPercent)%.
    shopPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
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

module.exports = mongoose.model("Service", serviceSchema);
