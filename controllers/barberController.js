const Barber = require("../models/Barber");

// GET /api/barbers  (worker or admin, scoped to their shop)
const listBarbers = async (req, res, next) => {
  try {
    const barbers = await Barber.find({
      barberShop: req.user.barberShop,
      isActive: true,
    }).sort({ name: 1 });
    res.json(barbers);
  } catch (err) {
    next(err);
  }
};

// POST /api/barbers  (admin only)
const createBarber = async (req, res, next) => {
  try {
    const { name, phone, paymentDay } = req.body;

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    const barber = await Barber.create({
      name: name.trim(),
      phone,
      paymentDay,
      barberShop: req.user.barberShop,
    });

    res.status(201).json(barber);
  } catch (err) {
    next(err);
  }
};

// PUT /api/barbers/:id  (admin only)
const updateBarber = async (req, res, next) => {
  try {
    const barber = await Barber.findOneAndUpdate(
      { _id: req.params.id, barberShop: req.user.barberShop },
      req.body,
      { new: true, runValidators: true }
    );

    if (!barber) {
      return res.status(404).json({ message: "Barber not found" });
    }

    res.json(barber);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/barbers/:id  (admin only)
const deleteBarber = async (req, res, next) => {
  try {
    const barber = await Barber.findOneAndDelete({
      _id: req.params.id,
      barberShop: req.user.barberShop,
    });

    if (!barber) {
      return res.status(404).json({ message: "Barber not found" });
    }

    res.json({ message: "Barber deleted" });
  } catch (err) {
    next(err);
  }
};

module.exports = { listBarbers, createBarber, updateBarber, deleteBarber };
