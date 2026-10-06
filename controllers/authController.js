const bcrypt = require("bcryptjs");
const BarberShop = require("../models/BarberShop");
const Worker = require("../models/Worker");
const Admin = require("../models/Admin");
const SuperAdmin = require("../models/SuperAdmin");
const ChainAdmin = require("../models/ChainAdmin");
const generateToken = require("../utils/generateToken");
const {trialEndDate } = require("../utils/pricing")
const jwt = require("jsonwebtoken");

// Helper function to set cookie
const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/'
  });
};

// Helper function to clear cookie
const clearTokenCookie = (res) => {
  res.cookie('token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 0,
    path: '/'
  });
};

const workerLogin = async (req, res, next) => {
  try {
    const { name, password, barberCode } = req.body;

    if (!name || !password || !barberCode) {
      return res.status(400).json({ message: "name, password and barberCode are required" });
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

    setTokenCookie(res, token);

    return res.json({
      user: { id: worker._id, name: worker.name, role: "worker", isActive: worker.isActive },
      barberShop: { id: shop._id, name: shop.name },
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { name, password, barberCode } = req.body;

    if (!name || !password) {
      return res.status(400).json({ message: "name and password are required" });
    }

    // No barber code -> this is a chain_admin login attempt, not shop-scoped.
    if (!barberCode) {
      const chainAdmin = await ChainAdmin.findOne({ name: name.trim() });
      if (!chainAdmin) {
        return res.status(401).json({ message: "Invalid name or password" });
      }
      const match = await bcrypt.compare(password, chainAdmin.password);
      if (!match) {
        return res.status(401).json({ message: "Invalid name or password" });
      }
      const token = generateToken({ id: chainAdmin._id, role: "chain_admin" });
      setTokenCookie(res, token);
      return res.json({
        user: { id: chainAdmin._id, name: chainAdmin.name, role: "chain_admin" },
      });
    }

    const shop = await BarberShop.findOne({
      barberCode: barberCode.trim().toUpperCase(),
    });

    if (!shop) {
      return res.status(404).json({ message: "No Shop with the provided BARBER CODE available" });
    }

    if (!shop.isActive) {
      return res.status(404).json({ message: "You shop is not activate So call to Fanuel Bahta" });
    }

    const trimmedName = name.trim();

    const admin = await Admin.findOne({ name: trimmedName, barberShop: shop._id });
    if (admin) {
      const match = await bcrypt.compare(password, admin.password);
      if (!match) {
        return res.status(401).json({ message: "Invalid name or password" });
      }
      const token = generateToken({ id: admin._id, role: "admin", barberShop: shop._id });
      setTokenCookie(res, token);

      return res.json({
        user: { id: admin._id, name: admin.name, role: "admin" },
        barberShop: { id: shop._id, name: shop.name },
      });
    }

    let worker = await Worker.findOne({ name: trimmedName, barberShop: shop._id });

    if (!worker) {
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
    setTokenCookie(res, token);

    return res.json({
      user: { id: worker._id, name: worker.name, role: "worker", isActive: worker.isActive },
      barberShop: { id: shop._id, name: shop.name },
    });
  } catch (err) {
    next(err);
  }
};

const adminLogin = async (req, res, next) => {
  try {
    const { name, password, barberCode } = req.body;

    if (!name || !password || !barberCode) {
      return res.status(400).json({ message: "name, password and barberCode are required" });
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

    // Set cookie instead of sending token
    setTokenCookie(res, token);

    res.json({
      user: { id: admin._id, name: admin.name, role: "admin" },
      barberShop: { id: shop._id, name: shop.name },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/chainadmin-setup
// body: { token, name, password }
const acceptChainAdminInvite = async (req, res, next) => {
  try {
    const { token, name, password } = req.body;
   if (!token || !name || !password) {
      return res.status(400).json({ message: "token, name and password are required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: "Invite link is invalid or has expired" });
    }
    if (decoded.purpose !== "chainadmin-invite") {
      return res.status(400).json({ message: "Invalid invite token" });
    }

    const existing = await ChainAdmin.findOne({ email: decoded.email });
    if (existing) {
      return res.status(409).json({ message: "An account already exists for this invite" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const chainAdmin = await ChainAdmin.create({
      name: name.trim(),
      password: hashed,
      email: decoded.email,
      shops: [],
      subscriptionStatus:"trial",
      trialEndsAt:trialEndDate(),
    });

    const sessionToken = generateToken({ id: chainAdmin._id, role: "chain_admin" });
    setTokenCookie(res, sessionToken);

    res.status(201).json({
      user: { id: chainAdmin._id, name: chainAdmin.name, role: "chain_admin" },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "That name is already taken" });
    }
    next(err);
  }
};

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

    // Set cookie instead of sending token
    setTokenCookie(res, token);

    res.json({
      user: { id: superAdmin._id, name: superAdmin.name, role: "superadmin" },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/admin-setup
// body: { token, name, password }
// Consumes an invite token, creates the Admin, logs them straight in.
const acceptAdminInvite = async (req, res, next) => {
  try {
    const { token, name, password } = req.body;
    if (!token || !name || !password) {
      return res.status(400).json({ message: "token, name and password are required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: "Invite link is invalid or has expired" });
    }
    if (decoded.purpose !== "admin-invite") {
      return res.status(400).json({ message: "Invalid invite token" });
    }

    const shop = await BarberShop.findById(decoded.shopId);
    if (!shop || !shop.isActive) {
      return res.status(404).json({ message: "Barber shop not found" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const admin = await Admin.create({
      name: name.trim(),
      password: hashed,
      barberShop: shop._id,
    });

    const sessionToken = generateToken({ id: admin._id, role: "admin", barberShop: shop._id });+    setTokenCookie(res, sessionToken);
    res.status(201).json({
      user: { id: admin._id, name: admin.name, role: "admin" },
      barberShop: { id: shop._id, name: shop.name },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "That name is already taken for this shop" });
    }
    next(err);
  }
};

// Add new logout endpoint
const logout = async (req, res) => {
  clearTokenCookie(res);
  res.json({ message: "Logged out successfully" });
};

// Add endpoint to verify session and get current user
const getCurrentUser = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }
  
    
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role === 'superadmin') {
      const superAdmin = await SuperAdmin.findById(decoded.id);
      return res.json({
        user: { id: superAdmin._id, name: superAdmin.name, role: "superadmin" },
      });
    }
    
    if (decoded.role === 'chain_admin') {
      const chainAdmin = await ChainAdmin.findById(decoded.id);
      if (!chainAdmin) return res.status(401).json({ message: "Not authenticated" });
      return res.json({
        user: { id: chainAdmin._id, name: chainAdmin.name, role: "chain_admin" },
      });
    }
    
    if (decoded.role === 'admin') {
      const admin = decoded.viewingAsChainAdmin
        ? await ChainAdmin.findById(decoded.id)
        : await Admin.findById(decoded.id);
       if (!admin) return res.status(401).json({ message: "Not authenticated" });
      const shop = await BarberShop.findById(decoded.barberShop);
      if (!shop) return res.status(401).json({ message: "Not authenticated" });
      return res.json({
        user: { id: admin._id, name: admin.name, role: "admin" },
        barberShop: { id: shop._id, name: shop.name },
      });
    }
    
    if (decoded.role === 'worker') {
      const worker = await Worker.findById(decoded.id);
      if (!worker) return res.status(401).json({ message: "Not authenticated" });
      const shop = await BarberShop.findById(decoded.barberShop);
      if (!shop) return res.status(401).json({ message: "Not authenticated" });
      return res.json({
        user: { id: worker._id, name: worker.name, role: "worker",isActive: worker.isActive },
        barberShop: { id: shop._id, name: shop.name },
      });
    }
    
    res.status(400).json({ message: "Invalid user role" });
  } catch (err) {
    next(err);
  }
};


const getCurrentSuperAdmin = async (req, res, next) => {
  try {
    const superAdmin = await SuperAdmin.findById(req.user.id);
    
    if (!superAdmin) {
      return res.status(404).json({ message: "Super admin not found" });
    }
    
    res.json({
      user: { 
        id: superAdmin._id, 
        name: superAdmin.name, 
        email: superAdmin.email,
        role: "superadmin" 
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { 
  login, 
  workerLogin, 
  adminLogin, 
  superAdminLogin, 
  logout, 
  getCurrentUser,
  getCurrentSuperAdmin,
  acceptAdminInvite,
  acceptChainAdminInvite,
  setTokenCookie
};
