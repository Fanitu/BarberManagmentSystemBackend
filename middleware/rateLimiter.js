const rateLimit = require("express-rate-limit");

// Applied globally to the whole API — a baseline guard against abusive
// traffic, generous enough that it should never bother a real user.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

// Applied only to login endpoints — much stricter, since these are the
// highest-value target for brute-forcing a worker/admin/superadmin password.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later." },
});

module.exports = { generalLimiter, authLimiter };