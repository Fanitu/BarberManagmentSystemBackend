const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const { getRevenue, getRevenueHistory } = require("../controllers/revenueController");

router.get("/history", protect, requireRole("admin"), getRevenueHistory);
router.get("/", protect, requireRole("admin"), getRevenue);

module.exports = router;
