const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const { handleValidationErrors } = require("../middleware/validate");
const {
  createShopValidator,
  shopIdParamValidator,
  createShopAdminValidator,
} = require("../validators/superAdminValidators");
const {
  createBarberShop,
  listBarberShops,
  deactivateBarberShop,
  createShopAdmin,
} = require("../controllers/superAdminController");

router.use(protect, requireRole("superadmin"));

router.post("/shops", createShopValidator, handleValidationErrors, createBarberShop);
router.get("/shops", listBarberShops);
router.patch(
  "/shops/:id/deactivate",
  shopIdParamValidator,
  handleValidationErrors,
  deactivateBarberShop
);
router.post(
  "/shops/:id/admins",
  createShopAdminValidator,
  handleValidationErrors,
  createShopAdmin
);

module.exports = router;
