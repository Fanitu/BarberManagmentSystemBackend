require("dotenv").config();
process.env.TZ = process.env.APP_TIMEZONE || "Africa/Addis_Ababa";
const express = require("express");
const cookieParser = require('cookie-parser');
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { generalLimiter } = require("./middleware/rateLimiter");
const { startPayoutCron } = require("./cron/payoutCron");
const { startDailySummaryCron } = require("./cron/dailySummaryCron");

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

// Security headers
app.use(helmet());


const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || "https://barber-super-admin-seven.vercel.app,https://barber-managment-system.vercel.app"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header = non-browser request (curl, Postman, server-to-server,
      // health checks) — allow those through; browsers always send Origin.
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`Origin "${origin}" is not allowed by CORS`));
    },
    credentials: true, // needed once auth moves to cookies (next phase)
  })
);

app.use(express.json());

app.use(mongoSanitize());

// Add this before your routes
app.use(cookieParser());

app.use("/api", generalLimiter);

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
  startDailySummaryCron();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

start();
