const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../middleware/auth");
const { listMyShops, createShop, enterShopView, exitShopView,getReports,getShopsRevenueOverview,listPayableBarbersToday, payBarberNow, listPayoutHistory, getPayoutDetail,getShopsIncomeHistory,getShopsBarbersHistory,getShopsMonthlyExpense,listAllBarbers, updateBarber, deleteBarber, listAllWorkers,activateWorker, deactivateWorker, deleteWorker,getShopsProgress,getSettings,setEmailAnalysisEnabled,listRunningCosts, createRunningCost, listMonthlyExpenses, createMonthlyExpense,getOverallProfit,
    listAllServices, createShopService, updateShopService, deleteShopService,changeChainAdminPassword,saveTelegramPhone, setTelegramAnalysisEnabled , updateMonthlyExpense, deleteMonthlyExpense 
 } = require("../controllers/chainAdminController");

router.post("/exit-shop-view", protect, exitShopView); // role is "admin" here, checked inside

router.use(protect, requireRole("chain_admin"));
router.get("/shops", listMyShops);
router.post("/shops", createShop);
router.post("/shops/:id/enter", enterShopView);
router.get("/reports", getReports);
router.get("/shops/revenue-overview", getShopsRevenueOverview);

router.get("/shops-detail/income", getShopsIncomeHistory);
router.get("/shops-detail/barbers", getShopsBarbersHistory);
router.get("/shops-detail/monthly-expense", getShopsMonthlyExpense);

router.get("/payouts/today", listPayableBarbersToday);
router.post("/payouts/:barberId/pay", payBarberNow);
router.get("/payouts/history", listPayoutHistory);
router.get("/payouts/history/detail", getPayoutDetail);

router.get("/barbers", listAllBarbers);
router.put("/barbers/:id", updateBarber);
router.delete("/barbers/:id", deleteBarber);
router.get("/workers", listAllWorkers);
router.patch("/workers/:id/activate", activateWorker);
router.patch("/workers/:id/deactivate", deactivateWorker);
router.delete("/workers/:id", deleteWorker);
router.get("/shops-progress", getShopsProgress);

router.get("/running-costs", listRunningCosts);
router.post("/running-costs", createRunningCost);
router.get("/monthly-expenses", listMonthlyExpenses);
router.post("/monthly-expenses", createMonthlyExpense);

router.get("/settings", getSettings);
router.patch("/settings/email-analysis", setEmailAnalysisEnabled);
router.patch("/settings/password",(req,res,next) =>{ 
    console.log("PATCH /settings/password called with body:", req.body) 
    next()}, changeChainAdminPassword);

router.patch("/settings/telegram-phone", saveTelegramPhone);
router.patch("/settings/telegram-analysis", setTelegramAnalysisEnabled);
router.get("/services", listAllServices);
router.post("/services", createShopService);
router.put("/services/:id", updateShopService);
router.delete("/services/:id", deleteShopService);

router.get("/overall-profit", getOverallProfit);

router.put("/monthly-expenses/:id", updateMonthlyExpense);
router.delete("/monthly-expenses/:id", deleteMonthlyExpense);
module.exports = router;