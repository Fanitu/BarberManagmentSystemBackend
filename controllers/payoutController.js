const Barber = require("../models/Barber");
const ServiceLog = require("../models/ServiceLog");
const Debt = require("../models/Debt");

/**
 * Computes a barber's payout snapshot from all of their unpaid service logs
 * and unpaid debts (unpaid, not date-bound — status is the source of truth
 * for "has this already been paid out").
 */
const computeBarberPayout = async (barberId, barberShop) => {
  const [logs, debts] = await Promise.all([
    ServiceLog.find({ barber: barberId, barberShop, status: "unpaid" }),
    Debt.find({ barber: barberId, barberShop, status: "unpaid" }),
  ]);

  const totalServicesIncome = logs.reduce(
    (sum, log) => sum + (log.price * (100 - log.shopPercent)) / 100,
    0
  );
  const debtAmount = debts.reduce((sum, d) => sum + d.amount, 0);
  const finalIncome = totalServicesIncome - debtAmount;

  return {
    totalServicesIncome,
    debtAmount,
    finalIncome,
    serviceLogIds: logs.map((l) => l._id),
    debtIds: debts.map((d) => d._id),
  };
};

/**
 * GET /api/payouts/today  (admin only)
 * Lists barbers whose paymentDay matches today, with their computed payout.
 */
const listPayableBarbersToday = async (req, res, next) => {
  try {
    const todayWeekday = new Date().getDay(); // 0 = Sunday ... 6 = Saturday

    const barbers = await Barber.find({
      barberShop: req.user.barberShop,
      paymentDay: todayWeekday,
      isActive: true,
    });

    const payouts = await Promise.all(
      barbers.map(async (barber) => {
        const payout = await computeBarberPayout(barber._id, req.user.barberShop);
        return {
          barber: { id: barber._id, name: barber.name },
          ...payout,
        };
      })
    );

    res.json(payouts);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/payouts/:barberId/pay  (admin only)
 * Marks all of the barber's unpaid service logs and debts as paid.
 */
const payBarberNow = async (req, res, next) => {
  try {
    const { barberId } = req.params;
    const barberShop = req.user.barberShop;

    const barber = await Barber.findOne({ _id: barberId, barberShop });
    if (!barber) return res.status(404).json({ message: "Barber not found" });

    const payout = await computeBarberPayout(barberId, barberShop);
    const now = new Date();
    console.log("payable barber", barber.name);
    console.log("service logs to mark as paid", payout.serviceLogIds);
    console.log("debts to mark as paid", payout.debtIds);

    await Promise.all([
      ServiceLog.updateMany(
        { _id: { $in: payout.serviceLogIds } },
        { status: "paid", paidAt: now }
      ),
      Debt.updateMany(
        { _id: { $in: payout.debtIds } },
        { status: "paid", paidAt: now }
      ),
    ]);

    res.json({
      message: `${barber.name} marked as paid`,
      barber: { id: barber._id, name: barber.name },
      totalServicesIncome: payout.totalServicesIncome,
      debtAmount: payout.debtAmount,
      finalIncome: payout.finalIncome,
      paidAt: now,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { computeBarberPayout, listPayableBarbersToday, payBarberNow };
