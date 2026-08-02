const MonthlyExpense = require("../models/MonthlyExpense");
const { startOfAddisMonth } = require("../utils/dateRanges");

// GET /api/monthly-expenses  (admin only)
// Only shows active (not-yet-deleted) expenses — deactivated ones stay in
// the database for historical revenue calculations, but disappear from
// this list, same as the admin sees it.
const listMonthlyExpenses = async (req, res, next) => {
  try {
    const expenses = await MonthlyExpense.find({
      barberShop: req.user.barberShop,
      isActive: true,
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
      month: month ? startOfAddisMonth(new Date(month)) : undefined,
      barberShop: req.user.barberShop,
    });

    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
};
  const updateMonthlyExpense = async (req, res, next) => {
   try{
     const { name, price } = req.body;
     if (!name && price == null) {
       return res.status(400).json({ message: "name or price is required" });
     }

     const existing = await MonthlyExpense.findOne({
       _id: req.params.id, barberShop: req.user.barberShop, isActive: true,
     });
     if (!existing) {
       return res.status(404).json({ message: "Monthly expense not found" });
     }

     const currentMonthStart = startOfAddisMonth();

     // Created this same month -> nothing historical to protect, edit in place.
     if (existing.month.getTime() === currentMonthStart.getTime()) {
       if (name) existing.name = name.trim();
       if (price != null) existing.price = price;
       await existing.save();
       return res.json(existing);
     }

     // Otherwise: close out the old version as of end of last month...
     existing.isActive = false;
     existing.deactivatedAt = new Date(currentMonthStart.getTime() - 1);
     await existing.save();

     // ...and open a new version, starting this month, with the update applied.
     const updated = await MonthlyExpense.create({
      name: name ? name.trim() : existing.name,
       price: price != null ? price : existing.price,
       month: currentMonthStart,
       barberShop: req.user.barberShop,
     });

     res.json(updated);
    } catch (err) {
      next(err);
    }
  };

// DELETE /api/monthly-expenses/:id  (admin only)
// Soft-delete: marks the expense inactive as of now instead of removing
// it. It still counts toward the calendar month it was deactivated in,
// and every month before that — only future months stop counting it.
const deleteMonthlyExpense = async (req, res, next) => {
  try {
    const expense = await MonthlyExpense.findOneAndUpdate(
      { _id: req.params.id, barberShop: req.user.barberShop, isActive: true },
      { isActive: false, deactivatedAt: new Date() },
      { new: true }
    );

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