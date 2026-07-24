const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const {
  createRunningCost,
  listRunningCosts,
} = require("../controllers/runningCostController");

router.post("/", protect, requireRole("admin"), createRunningCost);
router.get("/", protect, requireRole("admin"), listRunningCosts);

module.exports = router;
