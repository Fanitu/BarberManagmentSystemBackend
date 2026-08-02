const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const { handleValidationErrors } = require("../middleware/validate");
const { createDebtValidator } = require("../validators/debtValidators");
const { createDebt, listTodayDebts } = require("../controllers/debtController");

router.post(
  "/",
  protect,
  requireRole("worker"),
  createDebtValidator,
  handleValidationErrors,
  createDebt
);
router.get("/today", protect, requireRole("worker", "admin"), listTodayDebts);

module.exports = router;

