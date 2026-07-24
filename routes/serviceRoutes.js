const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const {
  listServices,
  createService,
  updateService,
  deleteService,
  submitServiceLog,
  listTodayServiceLogs,
} = require("../controllers/serviceController");

router.get("/", protect, requireRole("worker", "admin"), listServices);
router.post("/", protect, requireRole("admin"), createService);
router.put("/:id", protect, requireRole("admin"), updateService);
router.delete("/:id", protect, requireRole("admin"), deleteService);

router.post("/log", protect, requireRole("worker"), submitServiceLog);
router.get("/log/today", protect, requireRole("worker", "admin"), listTodayServiceLogs);

module.exports = router;
