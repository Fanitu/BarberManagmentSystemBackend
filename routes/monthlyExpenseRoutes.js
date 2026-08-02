const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const { handleValidationErrors } = require("../middleware/validate");
const {
  createMonthlyExpenseValidator,
  updateMonthlyExpenseValidator,
  monthlyExpenseIdParamValidator,
} = require("../validators/monthlyExpenseValidators");
const {
  listMonthlyExpenses,
  createMonthlyExpense,
  updateMonthlyExpense,
  deleteMonthlyExpense,
} = require("../controllers/monthlyExpenseController");

router.get("/", protect, requireRole("admin"), listMonthlyExpenses);

router.post(
  "/",
  protect,
  requireRole("admin"),
  createMonthlyExpenseValidator,
  handleValidationErrors,
  createMonthlyExpense
);

router.put(
  "/:id",
  protect,
  requireRole("admin"),
  updateMonthlyExpenseValidator,
  handleValidationErrors,
  updateMonthlyExpense
);

router.delete(
  "/:id",
  protect,
  requireRole("admin"),
  monthlyExpenseIdParamValidator,
  handleValidationErrors,
  deleteMonthlyExpense
);

module.exports = router;
