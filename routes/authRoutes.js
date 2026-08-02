const express = require("express");
const router = express.Router();
const { login, workerLogin, adminLogin, superAdminLogin } = require("../controllers/authController");
const { authLimiter } = require("../middleware/rateLimiter");
const { handleValidationErrors } = require("../middleware/validate");
const { loginValidator, superAdminLoginValidator } = require("../validators/authValidators");

// Every login route gets the strict authLimiter (on top of the general
// API limiter applied globally in server.js) — these are the highest-value
// target for brute-forcing a password.

// Unified login used by the merged worker/admin frontend — role comes back from the server.
router.post("/login", authLimiter, loginValidator, handleValidationErrors, login);

// Kept for backward compatibility / anything still calling these directly.
router.post("/worker/login", authLimiter, loginValidator, handleValidationErrors, workerLogin);
router.post("/admin/login", authLimiter, loginValidator, handleValidationErrors, adminLogin);
router.post(
  "/superadmin/login",
  authLimiter,
  superAdminLoginValidator,
  handleValidationErrors,
  superAdminLogin
);

module.exports = router;
