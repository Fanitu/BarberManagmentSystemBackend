const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const { createDebt, listTodayDebts } = require("../controllers/debtController");

router.post("/", protect, requireRole("worker"), createDebt);
router.get("/today", protect, requireRole("worker", "admin"), listTodayDebts);

module.exports = router;
