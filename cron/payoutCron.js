const cron = require("node-cron");
const Barber = require("../models/Barber");
const { computeBarberPayout } = require("../controllers/payoutController");

/**
 * Finds every barber, across every shop, whose paymentDay matches today,
 * and computes what they're owed from unpaid service logs + debts.
 *
 * IMPORTANT: this does NOT mark anything as paid. Per spec, the cron job's
 * only responsibility is to find and calculate the day's payable barbers
 * (which is what populates the Admin UI's "Payable Barbers" view — that
 * view also recomputes live on load, so this log is informational/for
 * future use, e.g. a morning notification to the admin). The actual
 * status flip from "unpaid" to "paid" happens ONLY when the admin clicks
 * "Pay Now" for a specific barber (POST /api/payouts/:barberId/pay).
 */
const runDailyPayout = async () => {
  const todayWeekday = new Date().getDay();

  const barbers = await Barber.find({ paymentDay: todayWeekday, isActive: true });

  console.log(`[payout-cron] ${barbers.length} barber(s) due for payout today`);

  for (const barber of barbers) {
    try {
      const payout = await computeBarberPayout(barber._id, barber.barberShop);
      console.log(
        `[payout-cron] ${barber.name} is payable today: finalIncome=${payout.finalIncome} (awaiting admin's Pay Now click)`
      );
    } catch (err) {
      console.error(
        `[payout-cron] Failed to compute payout for barber ${barber._id}:`,
        err.message
      );
    }
  }
};

const startPayoutCron = () => {
  const expression = process.env.PAYOUT_CRON_EXPRESSION || "0 9 * * *";
  const timezone = process.env.PAYOUT_TIMEZONE || "Africa/Addis_Ababa";

  cron.schedule(expression, runDailyPayout, { timezone });
  console.log(`[payout-cron] scheduled "${expression}" (${timezone})`);
};

module.exports = { startPayoutCron, runDailyPayout };
