const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const {
  listBarbers,
  createBarber,
  updateBarber,
  deleteBarber,
} = require("../controllers/barberController");

router.get("/", protect, requireRole("worker", "admin"), listBarbers);
router.post("/", protect, requireRole("admin"), createBarber);
router.put("/:id", protect, requireRole("admin"), updateBarber);
router.delete("/:id", protect, requireRole("admin"), deleteBarber);

module.exports = router;
