require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { startPayoutCron } = require("./cron/payoutCron");

const authRoutes = require("./routes/authRoutes");
const barberRoutes = require("./routes/barberRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const debtRoutes = require("./routes/debtRoutes");
const runningCostRoutes = require("./routes/runningCostRoutes");
const monthlyExpenseRoutes = require("./routes/monthlyExpenseRoutes");
const revenueRoutes = require("./routes/revenueRoutes");
const payoutRoutes = require("./routes/payoutRoutes");
const superAdminRoutes = require("./routes/superAdminRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/barbers", barberRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/debts", debtRoutes);
app.use("/api/running-costs", runningCostRoutes);
app.use("/api/monthly-expenses", monthlyExpenseRoutes);
app.use("/api/revenue", revenueRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/superadmin", superAdminRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  startPayoutCron();
  app.listen(PORT,'0.0.0.0', () => console.log(`Server running on port ${PORT}`));
};

start();
