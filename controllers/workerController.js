const Worker = require("../models/Worker");

// GET /api/workers  (admin only)
const listWorkers = async (req, res, next) => {
  try {
    const workers = await Worker.find({ barberShop: req.user.barberShop })
      .select("-password")
      .sort({ name: 1 });
    res.json(workers);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/workers/:id/activate  (admin only)
const activateWorker = async (req, res, next) => {
  try {
    const worker = await Worker.findOneAndUpdate(
      { _id: req.params.id, barberShop: req.user.barberShop },
      { isActive: true },
      { new: true }
    ).select("-password");
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    res.json(worker);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/workers/:id/deactivate  (admin only)
const deactivateWorker = async (req, res, next) => {
  try {
    const worker = await Worker.findOneAndUpdate(
      { _id: req.params.id, barberShop: req.user.barberShop },
      { isActive: false },
      { new: true }
    ).select("-password");
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    res.json(worker);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/workers/:id  (admin only)
const deleteWorker = async (req, res, next) => {
  try {
    const worker = await Worker.findOneAndDelete({
      _id: req.params.id,
      barberShop: req.user.barberShop,
    });
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    res.json({ message: "Worker deleted" });
  } catch (err) {
    next(err);
  }
};

module.exports = { listWorkers, activateWorker, deactivateWorker, deleteWorker };