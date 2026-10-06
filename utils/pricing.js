const TRIAL_DAYS = 7;

const monthlyPriceForShopCount = (shopCount) => {
  if (shopCount <= 1) return 800;
  if (shopCount === 2) return 1200;
  if (shopCount === 3) return 1600;
  return 2000;
};

//Chain admin pricing never drops to the single-shop rate — it starts at
// the 2-shop tier even if the chain currently only has 1 shop.
const chainMonthlyPriceForShopCount = (shopCount) => {
  if (shopCount <= 2) return 1200;
  if (shopCount === 3) return 1600;
  return 2000;
};

// Yearly = 10 months' worth, 2 months free — same ratio for both tiers.
const yearlyPriceForShopCount = (shopCount) => monthlyPriceForShopCount(shopCount) * 10;

const chainYearlyPriceForShopCount = (shopCount) => chainMonthlyPriceForShopCount(shopCount) * 10;
const trialEndDate = (fromDate = new Date()) => {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
};

// Extends from the shop's current nextPaymentDue if it's still in the
// future (so early renewal doesn't lose paid-for days); otherwise from now.
const advanceCycle = (currentNextPaymentDue, cycle) => {
  const base = currentNextPaymentDue && currentNextPaymentDue > new Date()
    ? new Date(currentNextPaymentDue)
    : new Date();
  if (cycle === "yearly") base.setFullYear(base.getFullYear() + 1);
  else base.setMonth(base.getMonth() + 1);
  return base;
};

module.exports = { TRIAL_DAYS, monthlyPriceForShopCount, yearlyPriceForShopCount, chainMonthlyPriceForShopCount, chainYearlyPriceForShopCount, trialEndDate, advanceCycle };