const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const { handleValidationErrors } = require("../middleware/validate");
const {
  createBarberValidator,
  updateBarberValidator,
  barberIdParamValidator,
} = require("../validators/barberValidators");
const {
  listBarbers,
  createBarber,
  updateBarber,
  deleteBarber,
} = require("../controllers/barberController");

router.get("/", protect, requireRole("worker", "admin"), listBarbers);

router.post(
  "/",
  protect,
  requireRole("admin"),
  createBarberValidator,
  handleValidationErrors,
  createBarber
);

router.put(
  "/:id",
  protect,
  requireRole("admin"),
  updateBarberValidator,
  handleValidationErrors,
  updateBarber
);

router.delete(
  "/:id",
  protect,
  requireRole("admin"),
  barberIdParamValidator,
  handleValidationErrors,
  deleteBarber
);

module.exports = router;
