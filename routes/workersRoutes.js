const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const { listWorkers, activateWorker, deactivateWorker, deleteWorker } = require("../controllers/workerController");

router.use(protect, requireRole("admin"));
router.get("/", listWorkers);
router.patch("/:id/activate", activateWorker);
router.patch("/:id/deactivate", deactivateWorker);
router.delete("/:id", deleteWorker);

module.exports = router;