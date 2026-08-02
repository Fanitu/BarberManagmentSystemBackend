const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const { handleValidationErrors } = require("../middleware/validate");
const { payBarberValidator } = require("../validators/payoutValidators");
const {
  listPayableBarbersToday,
  payBarberNow,
} = require("../controllers/payoutController");

router.get("/today", protect, requireRole("admin"), listPayableBarbersToday);

router.post(
  "/:barberId/pay",
  protect,
  requireRole("admin"),
  payBarberValidator,
  handleValidationErrors,
  payBarberNow
);

module.exports = router;
