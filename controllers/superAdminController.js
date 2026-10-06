const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const BarberShop = require("../models/BarberShop");
const Admin = require("../models/Admin");
const ChainAdmin = require("../models/ChainAdmin");
const generateBarberCode = require("../utils/generateBarberCode");
const {
  trialEndDate,advanceCycle, monthlyPriceForShopCount, yearlyPriceForShopCount,
  chainMonthlyPriceForShopCount, chainYearlyPriceForShopCount,
 } = require("../utils/pricing")
const {sendAdminInvitationEmail , sendChainAdminInvitationEmail} = require("../utils/emailService");

// POST /api/superadmin/shops
// body: { name, ownerName, ownerPhone }
// Creates a new tenant and generates its unique barber code.
const createBarberShop = async (req, res, next) => {
  console.log("Creating barber shop with data:", req.body);
  try {
    const { name, ownerName, ownerPhone, ownerEmail } = req.body;

   /*  if (!name) {
      return res.status(400).json({ message: "name is required" });
    }
 */
    let barberCode;
    let attempts = 0;
    // Regenerate on the rare collision instead of failing the request.
    while (attempts < 5) {
      barberCode = generateBarberCode();
      const exists = await BarberShop.findOne({ barberCode });
      if (!exists) break;
      attempts += 1;
    }

    const shop = await BarberShop.create({
      name: name.trim(),
      ownerName,
      ownerPhone,
      ownerEmail,
      barberCode,
      subscriptionStatus:"trial",
      trialEndsAt:trialEndDate(),
    });

    res.status(201).json(shop);
  } catch (err) {
    next(err);
  }
};


// Shops already owned by a chain shouldn't appear in the standalone list.
const getChainOwnedShopIds = async () => {
  const chainAdmins = await ChainAdmin.find().select("shops");
  const ids = new Set();
  chainAdmins.forEach((ca) => ca.shops.forEach((s) => ids.add(s.toString())));
  return ids;
};
// GET /api/superadmin/shops
const listBarberShops = async (req, res, next) => {
  try {
    const shops = await BarberShop.find().sort({ createdAt: -1 });


  const chainOwnedShopIds = await getChainOwnedShopIds();
    const standaloneShops = shops.filter((shop) => !chainOwnedShopIds.has(shop._id.toString()));

    const withAdmins = await Promise.all(
      standaloneShops.map(async (shop) => {
        const admins = await Admin.find({ barberShop: shop._id }).select("name");
        return {
          ...shop.toObject(),
          admins: admins.map((a) => ({ id: a._id, name: a.name })),
          monthlyPrice: monthlyPriceForShopCount(1),
          yearlyPrice: yearlyPriceForShopCount(1),
        };
      })
    );
    res.json(withAdmins);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/superadmin/shops/:id/renew  body: { cycle: "monthly" | "yearly" }
const renewShopSubscription = async (req, res, next) => {
  try {
    const { cycle } = req.body;
    if (!["monthly", "yearly"].includes(cycle)) {
      return res.status(400).json({ message: "cycle must be monthly or yearly" });
    }

    const shop = await BarberShop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: "Barber shop not found" });
    if (shop.subscriptionStatus !== "paid") {
      return res.status(400).json({ message: "Shop must be on a paid subscription first" });
    }

    shop.billingCycle = cycle;
    shop.nextPaymentDue = advanceCycle(shop.nextPaymentDue, cycle);
    await shop.save();

    res.json(shop);
  } catch (err) {
   next(err);
  }
};

// PATCH /api/superadmin/shops/:id/activate
const activateShop = async (req, res, next) => {
  try {
    const shop = await BarberShop.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
   );
    if (!shop) return res.status(404).json({ message: "Barber shop not found" });
    res.json(shop);
  } catch (err) {
    next(err);
  }
};


// GET /api/superadmin/admins  — directory of single-shop admins
const listAllAdmins = async (req, res, next) => {
  try {
    const admins = await Admin.find().populate("barberShop", "name barberCode").sort({ name: 1 });
    res.json(
     admins.map((a) => ({
        id: a._id,
        name: a.name,
        shop: a.barberShop ? { id: a.barberShop._id, name: a.barberShop.name, barberCode: a.barberShop.barberCode } : null,
      }))
    );
  } catch (err) {
    next(err);
  }
};

// GET /api/superadmin/chain-admins  — directory of chain admins + their shops
const listAllChainAdmins = async (req, res, next) => {
  try {
    const chainAdmins = await ChainAdmin.find().populate("shops", "name barberCode").sort({ name: 1 });
    res.json(
      chainAdmins.map((ca) => ({
        id: ca._id,
        name: ca.name,
        email: ca.email,
        subscriptionStatus: ca.subscriptionStatus,
        shops: ca.shops.map((s) => ({ id: s._id, name: s.name, barberCode: s.barberCode })),
     }))
    );
  } catch (err) {
    next(err);
  }
};



// PATCH /api/superadmin/shops/:id/activate-paid  body: { nextPaymentDue }
const activateShopPaid = async (req, res, next) => {
  try {
    const { nextPaymentDue } = req.body;
    if (!nextPaymentDue) return res.status(400).json({ message: "nextPaymentDue is required" });

    const shop = await BarberShop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: "Barber shop not found" });

    shop.subscriptionStatus = "paid";
    shop.nextPaymentDue = new Date(nextPaymentDue);
    shop.billingCycle = null; // set on first renewal click
    await shop.save();

    res.json(shop);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/superadmin/shops/:id/deactivate
const deactivateBarberShop = async (req, res, next) => {
  try {
    const shop = await BarberShop.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!shop) return res.status(404).json({ message: "Barber shop not found" });
    res.json(shop);
  } catch (err) {
    next(err);
  }
};

// POST /api/superadmin/chain-admins/invite
// body: { email }
const inviteChainAdmin = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "email is required" });

    const token = jwt.sign(
      { email: email.trim().toLowerCase(), purpose: "chainadmin-invite" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    await sendChainAdminInvitationEmail(email.trim().toLowerCase(), token);
    res.json({ message: "Invite sent" });
  } catch (err) {
    next(err);
  }
};

// POST /api/superadmin/shops/:id/invite
// Emails the shop owner a link to set up their own admin account.
const inviteShopAdmin = async (req, res, next) => {
  try {
    const shop = await BarberShop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: "Barber shop not found" });
    if (!shop.ownerEmail) {
      return res.status(400).json({ message: "This shop has no owner email on file" });
    }

    const token = jwt.sign(
      { shopId: shop._id, purpose: "admin-invite" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    await sendAdminInvitationEmail(shop.ownerEmail, shop.name, token,shop.barberCode);
    res.json({ message: "Invite sent" });
  } catch (err) {
    next(err);
  }
};


// GET /api/superadmin/chain-admins/overview
const listChainAdminsOverview = async (req, res, next) => {
  try {
    const chainAdmins = await ChainAdmin.find().populate("shops", "name barberCode").sort({ name: 1 });

    const result = chainAdmins.map((ca) => {
      const shopCount = ca.shops.length;
      return {
        id: ca._id,
        name: ca.name,
        email: ca.email,
        subscriptionStatus: ca.subscriptionStatus,
        trialEndsAt: ca.trialEndsAt,
        nextPaymentDue: ca.nextPaymentDue,
        billingCycle: ca.billingCycle,
        shops: ca.shops.map((s) => ({ id: s._id, name: s.name, barberCode: s.barberCode })),
        monthlyPrice: chainMonthlyPriceForShopCount(shopCount),
        yearlyPrice: chainYearlyPriceForShopCount(shopCount),
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/superadmin/chain-admins/:id/renew  body: { cycle }
const renewChainAdminSubscription = async (req, res, next) => {
  try {
    const { cycle } = req.body;
    if (!["monthly", "yearly"].includes(cycle)) {
      return res.status(400).json({ message: "cycle must be monthly or yearly" });
    }
    const chainAdmin = await ChainAdmin.findById(req.params.id);
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });
    if (chainAdmin.subscriptionStatus !== "paid") {
      return res.status(400).json({ message: "Chain admin must be on a paid subscription first" });
    }

    chainAdmin.billingCycle = cycle;
    chainAdmin.nextPaymentDue = advanceCycle(chainAdmin.nextPaymentDue, cycle);
    await chainAdmin.save();

    res.json(chainAdmin);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/superadmin/chain-admins/:id/activate-paid  body: { nextPaymentDue }
const activateChainAdminPaid = async (req, res, next) => {
  try {
    const { nextPaymentDue } = req.body;
    if (!nextPaymentDue) return res.status(400).json({ message: "nextPaymentDue is required" });
    const chainAdmin = await ChainAdmin.findById(req.params.id);
    if (!chainAdmin) return res.status(404).json({ message: "Chain admin not found" });

    chainAdmin.subscriptionStatus = "paid";
    chainAdmin.nextPaymentDue = new Date(nextPaymentDue);
    chainAdmin.billingCycle = null;
    await chainAdmin.save();

    res.json(chainAdmin);
  } catch (err) {
    next(err);
}
};

// GET /api/superadmin/subscriptions/ending-soon?days=4
const listEndingSoon = async (req, res, next) => {
  try {
   const days = Number(req.query.days) || 4;
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const chainOwnedIds = await getChainOwnedShopIds();
    const [shops, chainAdmins] = await Promise.all([
      BarberShop.find({
        $or: [
          { subscriptionStatus: "trial", trialEndsAt: { $gte: now, $lte: cutoff } },
          { subscriptionStatus: "paid", nextPaymentDue: { $gte: now, $lte: cutoff } },
        ],
      }),
      ChainAdmin.find({
        $or: [
          { subscriptionStatus: "trial", trialEndsAt: { $gte: now, $lte: cutoff } },
          { subscriptionStatus: "paid", nextPaymentDue: { $gte: now, $lte: cutoff } },
        ],
      }).populate("shops", "name"),
    ]);

    const standaloneShops = shops.filter((s) => !chainOwnedIds.has(s._id.toString()));

    res.json({
      shops: standaloneShops.map((s) => ({
        id: s._id,
        type: "shop",
        name: s.name,
        subscriptionStatus: s.subscriptionStatus,
        endsAt: s.subscriptionStatus === "trial" ? s.trialEndsAt : s.nextPaymentDue,
      })),
      chainAdmins: chainAdmins.map((ca) => ({
        id: ca._id,
        type: "chain_admin",
        name: ca.name,
        shopNames: ca.shops.map((s) => s.name),
        subscriptionStatus: ca.subscriptionStatus,
        endsAt: ca.subscriptionStatus === "trial" ? ca.trialEndsAt : ca.nextPaymentDue,
     })),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/superadmin/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const chainOwnedIds = await getChainOwnedShopIds();
    const allShops = await BarberShop.find();
    const standaloneShops = allShops.filter((s) => !chainOwnedIds.has(s._id.toString()));
    const chainAdmins = await ChainAdmin.find().populate("shops", "_id");

   // --- Totals ---
    const totalShops = standaloneShops.length;
    const totalChainAdmins = chainAdmins.length;
   const activePaidShops = standaloneShops.filter((s) => s.subscriptionStatus === "paid").length;
   const activePaidChains = chainAdmins.filter((c) => c.subscriptionStatus === "paid").length;
  const trialShops = standaloneShops.filter((s) => s.subscriptionStatus === "trial").length;
    const trialChains = chainAdmins.filter((c) => c.subscriptionStatus === "trial").length;

    // --- Revenue, split by billing cycle, shops vs chains ---
    const revenue = { monthly: { shops: 0, chainAdmins: 0 }, yearly: { shops: 0, chainAdmins: 0 } };
   for (const shop of standaloneShops) {
      if (shop.subscriptionStatus !== "paid") continue;
      if (shop.billingCycle === "yearly") revenue.yearly.shops += yearlyPriceForShopCount(1);
     else if (shop.billingCycle === "monthly") revenue.monthly.shops += monthlyPriceForShopCount(1);
    }
    for (const ca of chainAdmins) {
      if (ca.subscriptionStatus !== "paid") continue;
      const count = ca.shops.length;
      if (ca.billingCycle === "yearly") revenue.yearly.chainAdmins += chainYearlyPriceForShopCount(count);
      else if (ca.billingCycle === "monthly") revenue.monthly.chainAdmins += chainMonthlyPriceForShopCount(count);
   }
    revenue.monthly.total = revenue.monthly.shops + revenue.monthly.chainAdmins;
   revenue.yearly.total = revenue.yearly.shops + revenue.yearly.chainAdmins;

    // --- Registrations over the last 30 days ---
    const days = 30;
    const now = new Date();
    const registrations = [];
    for (let offset = days - 1; offset >= 0; offset--) {
      const dayStart = new Date(now);
     dayStart.setDate(dayStart.getDate() - offset);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const shopsCount = standaloneShops.filter((s) => s.createdAt >= dayStart && s.createdAt <= dayEnd).length;
      const chainsCount = chainAdmins.filter((c) => c.createdAt >= dayStart && c.createdAt <= dayEnd).length;

      registrations.push({
        date: dayStart.toISOString().slice(0, 10),
        shops: shopsCount,
        chainAdmins: chainsCount,
      });
   }

    // --- Growth rate: total registered customers (shops + chains) at end of this month vs last month ---
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const countBefore = (cutoff) =>
      standaloneShops.filter((s) => s.createdAt < cutoff).length +
      chainAdmins.filter((c) => c.createdAt < cutoff).length;

    const totalNow = countBefore(new Date(now.getTime() + 1)); // include today
   const totalLastMonthEnd = countBefore(startOfThisMonth);
    const totalMonthBeforeEnd = countBefore(startOfLastMonth);

    const newThisMonth = totalNow - totalLastMonthEnd;
    const newLastMonth = totalLastMonthEnd - totalMonthBeforeEnd;
    const growthPercent =
      newLastMonth > 0
        ? Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 100)
        : newThisMonth > 0
        ? 100
        : 0;

    res.json({
      totals: {
        totalShops,
        totalChainAdmins,
        activePaid: activePaidShops + activePaidChains,
        trial: trialShops + trialChains,
      },
      revenue,
      registrations,
      growth: { newThisMonth, newLastMonth, growthPercent },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createBarberShop,
  listBarberShops,
  renewShopSubscription,
  activateShopPaid,
  deactivateBarberShop,
  activateShop,
  listAllAdmins,
  listAllChainAdmins,
  listChainAdminsOverview,
  renewChainAdminSubscription,
  activateChainAdminPaid,
  listEndingSoon,
  getDashboard,
  inviteShopAdmin,
  inviteChainAdmin
};
