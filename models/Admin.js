const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
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

// One admin name per shop
adminSchema.index({ name: 1, barberShop: 1 }, { unique: true });

module.exports = mongoose.model("Admin", adminSchema);
