const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const {
  getRevenue,
  getRevenueHistory,
  getDailyDetail,
  getWeeklyDetail,
  getMonthlyDetail,
  getMonthlyBarberPerformance
} = require("../controllers/revenueController");

router.get("/history", protect, requireRole("admin"), getRevenueHistory);
router.get("/daily-detail", protect, requireRole("admin"), getDailyDetail);
router.get("/weekly-detail", protect, requireRole("admin"), getWeeklyDetail);
router.get("/monthly-detail", protect, requireRole("admin"), getMonthlyDetail);
router.get("/monthly-barber-performance", protect, requireRole("admin"), getMonthlyBarberPerformance);
router.get("/", protect, requireRole("admin"), getRevenue);

module.exports = router;