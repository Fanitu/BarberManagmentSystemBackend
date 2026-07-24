const MonthlyExpense = require("../models/MonthlyExpense");

// GET /api/monthly-expenses  (admin only)
const listMonthlyExpenses = async (req, res, next) => {
  try {
    const expenses = await MonthlyExpense.find({
      barberShop: req.user.barberShop,
    }).sort({ month: -1, createdAt: -1 });
    res.json(expenses);
  } catch (err) {
    next(err);
  }
};

// POST /api/monthly-expenses  (admin only)
const createMonthlyExpense = async (req, res, next) => {
  try {
    const { name, price, month } = req.body;

    if (!name || price == null) {
      return res.status(400).json({ message: "name and price are required" });
    }

    const expense = await MonthlyExpense.create({
      name: name.trim(),
      price,
      month: month ? new Date(month) : undefined,
      barberShop: req.user.barberShop,
    });

    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
};

// PUT /api/monthly-expenses/:id  (admin only)
const updateMonthlyExpense = async (req, res, next) => {
  try {
    const expense = await MonthlyExpense.findOneAndUpdate(
      { _id: req.params.id, barberShop: req.user.barberShop },
      req.body,
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({ message: "Monthly expense not found" });
    }

    res.json(expense);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/monthly-expenses/:id  (admin only)
const deleteMonthlyExpense = async (req, res, next) => {
  try {
    const expense = await MonthlyExpense.findOneAndDelete({
      _id: req.params.id,
      barberShop: req.user.barberShop,
    });

    if (!expense) {
      return res.status(404).json({ message: "Monthly expense not found" });
    }

    res.json({ message: "Monthly expense deleted" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listMonthlyExpenses,
  createMonthlyExpense,
  updateMonthlyExpense,
  deleteMonthlyExpense,
};
