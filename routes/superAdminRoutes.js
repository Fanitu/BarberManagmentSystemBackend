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
  inviteShopAdmin,
  inviteChainAdmin,
  renewShopSubscription,
  activateShopPaid,
   activateShop,
  listAllAdmins,
  listAllChainAdmins,
  listChainAdminsOverview,
  renewChainAdminSubscription,
  activateChainAdminPaid,
  listEndingSoon,
  getDashboard,
} = require("../controllers/superAdminController");

router.use(protect, requireRole("superadmin"));

router.post("/shops",createBarberShop);
router.get("/shops", listBarberShops);
router.patch(
  "/shops/:id/deactivate",
  shopIdParamValidator,
  handleValidationErrors,
  deactivateBarberShop
);
router.post("/shops/:id/invite", shopIdParamValidator, handleValidationErrors, inviteShopAdmin);

router.post("/chain-admins/invite", inviteChainAdmin);

router.patch("/shops/:id/renew", shopIdParamValidator, handleValidationErrors, renewShopSubscription);
router.patch("/shops/:id/activate-paid", shopIdParamValidator, handleValidationErrors, activateShopPaid);

router.patch("/shops/:id/activate", shopIdParamValidator, handleValidationErrors, activateShop);
router.get("/admins", listAllAdmins);
router.get("/chain-admins", listAllChainAdmins);

router.get("/chain-admins/overview", listChainAdminsOverview);
router.patch("/chain-admins/:id/renew", renewChainAdminSubscription);
router.patch("/chain-admins/:id/activate-paid", activateChainAdminPaid);
router.get("/subscriptions/ending-soon", listEndingSoon);
router.get("/dashboard", getDashboard);
module.exports = router;
