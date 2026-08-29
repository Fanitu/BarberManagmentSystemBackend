const bcrypt = require("bcryptjs");
const BarberShop = require("../models/BarberShop");
const Worker = require("../models/Worker");
const Admin = require("../models/Admin");
const SuperAdmin = require("../models/SuperAdmin");
const generateToken = require("../utils/generateToken");

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

    // Set cookie instead of sending token
    setTokenCookie(res, token);

    res.json({
      user: { id: worker._id, name: worker.name, role: "worker" },
      barberShop: { id: shop._id, name: shop.name },
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
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

    const trimmedName = name.trim();

    const admin = await Admin.findOne({ name: trimmedName, barberShop: shop._id });
    if (admin) {
      const match = await bcrypt.compare(password, admin.password);
      if (!match) {
        return res.status(401).json({ message: "Invalid name or password" });
      }
      const token = generateToken({ id: admin._id, role: "admin", barberShop: shop._id });
      
      // Set cookie instead of sending token
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
    
    // Set cookie instead of sending token
    setTokenCookie(res, token);
    
    res.json({
      user: { id: worker._id, name: worker.name, role: "worker" },
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
    
    if (decoded.role === 'admin') {
      const admin = await Admin.findById(decoded.id);
      const shop = await BarberShop.findById(decoded.barberShop);
      return res.json({
        user: { id: admin._id, name: admin.name, role: "admin" },
        barberShop: { id: shop._id, name: shop.name },
      });
    }
    
    if (decoded.role === 'worker') {
      const worker = await Worker.findById(decoded.id);
      const shop = await BarberShop.findById(decoded.barberShop);
      return res.json({
        user: { id: worker._id, name: worker.name, role: "worker" },
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
  getCurrentSuperAdmin
};
