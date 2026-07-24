const RunningCost = require("../models/RunningCost");

// POST /api/running-costs  (admin only)
const createRunningCost = async (req, res, next) => {
  try {
    const { name, price } = req.body;

    if (!name || price == null) {
      return res.status(400).json({ message: "name and price are required" });
    }

    const cost = await RunningCost.create({
      name: name.trim(),
      price,
      barberShop: req.user.barberShop,
    });

    res.status(201).json(cost);
  } catch (err) {
    next(err);
  }
};

// GET /api/running-costs?from=&to=  (admin only)
const listRunningCosts = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const filter = { barberShop: req.user.barberShop };

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const costs = await RunningCost.find(filter).sort({ createdAt: -1 });
    res.json(costs);
  } catch (err) {
    next(err);
  }
};

module.exports = { createRunningCost, listRunningCosts };
