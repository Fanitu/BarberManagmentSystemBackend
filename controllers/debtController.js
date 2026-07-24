const Debt = require("../models/Debt");
const Barber = require("../models/Barber");

// POST /api/debts  (worker only)
// body: { barberId, amount }
const createDebt = async (req, res, next) => {
  try {
    const { barberId, amount } = req.body;

    if (!barberId || amount == null) {
      return res.status(400).json({ message: "barberId and amount are required" });
    }

    const barber = await Barber.findOne({
      _id: barberId,
      barberShop: req.user.barberShop,
    });

    if (!barber) return res.status(404).json({ message: "Barber not found" });

    const debt = await Debt.create({
      barber: barber._id,
      amount,
      recordedBy: req.user.id,
      barberShop: req.user.barberShop,
    });

    res.status(201).json(debt);
  } catch (err) {
    next(err);
  }
};

// GET /api/debts/today  (worker or admin)
const listTodayDebts = async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const debts = await Debt.find({
      barberShop: req.user.barberShop,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .populate("barber", "name")
      .sort({ createdAt: -1 });

    res.json(debts);
  } catch (err) {
    next(err);
  }
};

module.exports = { createDebt, listTodayDebts };
