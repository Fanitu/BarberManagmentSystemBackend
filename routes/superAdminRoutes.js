const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const {
  createBarberShop,
  listBarberShops,
  deactivateBarberShop,
  createShopAdmin,
} = require("../controllers/superAdminController");

router.use(protect, requireRole("superadmin"));

router.post("/shops", createBarberShop);
router.get("/shops", listBarberShops);
router.patch("/shops/:id/deactivate", deactivateBarberShop);
router.post("/shops/:id/admins", createShopAdmin);

module.exports = router;
