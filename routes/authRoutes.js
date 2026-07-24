const express = require("express");
const router = express.Router();
const { login, workerLogin, adminLogin, superAdminLogin } = require("../controllers/authController");

// Unified login used by the merged worker/admin frontend — role comes back from the server.
router.post("/login", login);

// Kept for backward compatibility / anything still calling these directly.
router.post("/worker/login", workerLogin);
router.post("/admin/login", adminLogin);
router.post("/superadmin/login", superAdminLogin);

module.exports = router;
