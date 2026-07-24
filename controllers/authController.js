const bcrypt = require("bcryptjs");
const BarberShop = require("../models/BarberShop");
const Worker = require("../models/Worker");
const Admin = require("../models/Admin");
const SuperAdmin = require("../models/SuperAdmin");
const generateToken = require("../utils/generateToken");

/**
 * POST /api/auth/worker/login
 * body: { name, password, barberCode }
 *
 * Matches the spec: if the barber code doesn't exist, tell the client.
 * If it exists, look for a worker with that name+password under the shop.
 * If no worker exists yet with that name, create one (first-login = signup).
 * If a worker with that name exists but the password doesn't match, reject.
 */
const workerLogin = async (req, res, next) => {
  try {
    const { name, password, barberCode } = req.body;

    if (!name || !password || !barberCode) {
      return res
        .status(400)
        .json({ message: "name, password and barberCode are required" });
    }

    const shop = await BarberShop.findOne({
      barberCode: barberCode.trim().toUpperCase(),
      isActive: true,
    });

    if (!shop) {
      return res.status(404).json({ message: "No BARBER CODE available" });
    }

    let worker = await Worker.findOne({ name: name.trim(), barberShop: shop._id });

    if (!worker) {
      // First time this name is used under this shop -> create the account.
      const hashed = await bcrypt.hash(password, 10);
      worker = await Worker.create({
        name: name.trim(),
        password: hashed,
        barberShop: shop._id,
      });
    } else {
      const match = await bcrypt.compare(password, worker.password);
      if (!match) {
        return res.status(401).json({ message: "Invalid name or password" });
      }
    }

    const token = generateToken({
      id: worker._id,
      role: "worker",
      barberShop: shop._id,
    });

    res.json({
      token,
      user: { id: worker._id, name: worker.name, role: "worker" },
      barberShop: { id: shop._id, name: shop.name },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * body: { name, password, barberCode }
 *
 * Unified login for the merged Worker/Admin frontend: the client doesn't
 * know or send a role, the backend figures out who "name" is under this
 * shop and returns the right one.
 *
 * Order matters: Admin accounts are provisioned ahead of time and never
 * auto-created, so we check Admin first. If no admin or worker matches
 * the name at all, we fall back to the worker auto-register behavior
 * (first login with a valid barber code creates a worker account) —
 * same as the original spec's worker-only flow.
 */
const login = async (req, res, next) => {
  try {
    const { name, password, barberCode } = req.body;

    if (!name || !password || !barberCode) {
      return res
        .status(400)
        .json({ message: "name, password and barberCode are required" });
    }

    const shop = await BarberShop.findOne({
      barberCode: barberCode.trim().toUpperCase(),
      isActive: true,
    });

    if (!shop) {
      return res.status(404).json({ message: "No BARBER CODE available" });
    }

    const trimmedName = name.trim();

    const admin = await Admin.findOne({ name: trimmedName, barberShop: shop._id });
    if (admin) {
      const match = await bcrypt.compare(password, admin.password);
      if (!match) {
        return res.status(401).json({ message: "Invalid name or password" });
      }
      const token = generateToken({ id: admin._id, role: "admin", barberShop: shop._id });
      return res.json({
        token,
        user: { id: admin._id, name: admin.name, role: "admin" },
        barberShop: { id: shop._id, name: shop.name },
      });
    }

    let worker = await Worker.findOne({ name: trimmedName, barberShop: shop._id });

    if (!worker) {
      // No admin and no worker with this name yet -> auto-register as a worker.
      const hashed = await bcrypt.hash(password, 10);
      worker = await Worker.create({
        name: trimmedName,
        password: hashed,
        barberShop: shop._id,
      });
    } else {
      const match = await bcrypt.compare(password, worker.password);
      if (!match) {
        return res.status(401).json({ message: "Invalid name or password" });
      }
    }

    const token = generateToken({ id: worker._id, role: "worker", barberShop: shop._id });
    res.json({
      token,
      user: { id: worker._id, name: worker.name, role: "worker" },
      barberShop: { id: shop._id, name: shop.name },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/admin/login
 * body: { name, password, barberCode }
 *
 * Admin accounts are provisioned ahead of time (via super admin / seed),
 * so this does not auto-create an account like the worker login does.
 */
const adminLogin = async (req, res, next) => {
  try {
    const { name, password, barberCode } = req.body;

    if (!name || !password || !barberCode) {
      return res
        .status(400)
        .json({ message: "name, password and barberCode are required" });
    }

    const shop = await BarberShop.findOne({
      barberCode: barberCode.trim().toUpperCase(),
      isActive: true,
    });

    if (!shop) {
      return res.status(404).json({ message: "No BARBER CODE available" });
    }

    const admin = await Admin.findOne({ name: name.trim(), barberShop: shop._id });

    if (!admin) {
      return res.status(401).json({ message: "Invalid name or password" });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid name or password" });
    }

    const token = generateToken({
      id: admin._id,
      role: "admin",
      barberShop: shop._id,
    });

    res.json({
      token,
      user: { id: admin._id, name: admin.name, role: "admin" },
      barberShop: { id: shop._id, name: shop.name },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/superadmin/login
 * body: { email, password }
 */
const superAdminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const superAdmin = await SuperAdmin.findOne({ email: email.trim().toLowerCase() });

    if (!superAdmin) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const match = await bcrypt.compare(password, superAdmin.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken({ id: superAdmin._id, role: "superadmin" });

    res.json({
      token,
      user: { id: superAdmin._id, name: superAdmin.name, role: "superadmin" },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, workerLogin, adminLogin, superAdminLogin };
