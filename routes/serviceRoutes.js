const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const { handleValidationErrors } = require("../middleware/validate");
const {
  createServiceValidator,
  updateServiceValidator,
  serviceIdParamValidator,
  submitServiceLogValidator,
  updateServiceLogValidator,
} = require("../validators/serviceValidators");
const {
  listServices,
  createService,
  updateService,
  deleteService,
  submitServiceLog,
  updateServiceLog,
  listTodayServiceLogs,
} = require("../controllers/serviceController");

router.get("/", protect, requireRole("worker", "admin"), listServices);

router.post(
  "/",
  protect,
  requireRole("admin"),
  createServiceValidator,
  handleValidationErrors,
  createService
);

router.put(
  "/:id",
  protect,
  requireRole("admin"),
  updateServiceValidator,
  handleValidationErrors,
  updateService
);

router.delete(
  "/:id",
  protect,
  requireRole("admin"),
  serviceIdParamValidator,
  handleValidationErrors,
  deleteService
);

router.post(
  "/log",
  protect,
  requireRole("worker"),
  submitServiceLogValidator,
  handleValidationErrors,
  submitServiceLog
);

router.put(
  "/log/:id",
  protect,
  requireRole("worker"),
  updateServiceLogValidator,
  handleValidationErrors,
  updateServiceLog
);

router.get("/log/today", protect, requireRole("worker", "admin"), listTodayServiceLogs);

module.exports = router;
