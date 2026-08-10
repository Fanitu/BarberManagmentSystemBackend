const bcrypt = require("bcryptjs");
const BarberShop = require("../models/BarberShop");
const Admin = require("../models/Admin");
const generateBarberCode = require("../utils/generateBarberCode");

// POST /api/superadmin/shops
// body: { name, ownerName, ownerPhone }
// Creates a new tenant and generates its unique barber code.
const createBarberShop = async (req, res, next) => {
  console.log("Creating barber shop with data:", req.body);
  try {
    const { name, ownerName, ownerPhone } = req.body;

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
      barberCode,
    });

    res.status(201).json(shop);
  } catch (err) {
    next(err);
  }
};

// GET /api/superadmin/shops
const listBarberShops = async (req, res, next) => {
  try {
    const shops = await BarberShop.find().sort({ createdAt: -1 });
    res.json(shops);
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

// POST /api/superadmin/shops/:id/admins
// body: { name, password }
// Provisions the first admin (owner) login for a shop.
const createShopAdmin = async (req, res, next) => {
  try {
    const { name, password } = req.body;
    const shop = await BarberShop.findById(req.params.id);

    if (!shop) return res.status(404).json({ message: "Barber shop not found" });
    if (!name || !password) {
      return res.status(400).json({ message: "name and password are required" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const admin = await Admin.create({
      name: name.trim(),
      password: hashed,
      barberShop: shop._id,
    });

    res.status(201).json({ id: admin._id, name: admin.name, barberShop: shop._id });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createBarberShop,
  listBarberShops,
  deactivateBarberShop,
  createShopAdmin,
};
