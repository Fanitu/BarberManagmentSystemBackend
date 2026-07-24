/**
 * Creates (or resets the password of) the platform's Super Admin account.
 * There is no public sign-up route for this role on purpose — this script
 * is how you provision it directly against the database.
 *
 * Usage:
 *   npm run seed:superadmin
 *
 * Reads SUPER_ADMIN_NAME / SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD from
 * .env. If an account with that email already exists, this updates its
 * name/password instead of failing — safe to re-run any time you forget
 * the password.
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const SuperAdmin = require("../models/SuperAdmin");

const run = async () => {
  const name = process.env.SUPER_ADMIN_NAME;
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.error(
      "Missing SUPER_ADMIN_NAME / SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD in .env"
    );
    process.exit(1);
  }

  await connectDB();

  const hashed = await bcrypt.hash(password, 10);
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await SuperAdmin.findOne({ email: normalizedEmail });

  if (existing) {
    existing.name = name.trim();
    existing.password = hashed;
    await existing.save();
    console.log(`Updated existing super admin: ${normalizedEmail}`);
  } else {
    await SuperAdmin.create({ name: name.trim(), email: normalizedEmail, password: hashed });
    console.log(`Created super admin: ${normalizedEmail}`);
  }

  process.exit(0);
};

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
