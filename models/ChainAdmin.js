const mongoose = require("mongoose");

const chainAdminSchema = new mongoose.Schema(
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
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    telegramAnalysisEnabled: {
      type: Boolean,
      default: false,
    },
    telegramPhone: {
      type: String,
      trim: true,
    },
    telegramChatId: {
      type: String,
    },
    shops: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BarberShop",
      },
    ],
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
    emailAnalysisEnabled: {
      type: Boolean,
      default: false, 
  },
},
  { timestamps: true }
);

module.exports = mongoose.model("ChainAdmin", chainAdminSchema);