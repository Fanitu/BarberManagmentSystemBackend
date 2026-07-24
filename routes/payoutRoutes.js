const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const {
  listPayableBarbersToday,
  payBarberNow,
} = require("../controllers/payoutController");

router.get("/today", protect, requireRole("admin"), listPayableBarbersToday);
router.post("/:barberId/pay", protect, requireRole("admin"), payBarberNow);

module.exports = router;
