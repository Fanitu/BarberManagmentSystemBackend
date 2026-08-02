const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const { handleValidationErrors } = require("../middleware/validate");
const { createRunningCostValidator } = require("../validators/runningCostValidators");
const {
  createRunningCost,
  listRunningCosts,
} = require("../controllers/runningCostController");

router.post(
  "/",
  protect,
  requireRole("admin"),
  createRunningCostValidator,
  handleValidationErrors,
  createRunningCost
);
router.get("/", protect, requireRole("admin"), listRunningCosts);

module.exports = router;
