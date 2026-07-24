const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const {
  listMonthlyExpenses,
  createMonthlyExpense,
  updateMonthlyExpense,
  deleteMonthlyExpense,
} = require("../controllers/monthlyExpenseController");

router.get("/", protect, requireRole("admin"), listMonthlyExpenses);
router.post("/", protect, requireRole("admin"), createMonthlyExpense);
router.put("/:id", protect, requireRole("admin"), updateMonthlyExpense);
router.delete("/:id", protect, requireRole("admin"), deleteMonthlyExpense);

module.exports = router;
