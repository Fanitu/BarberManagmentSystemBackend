const Service = require("../models/Service");
const ServiceLog = require("../models/ServiceLog");
const Barber = require("../models/Barber");

// GET /api/services  (worker or admin) - the service catalog for selects
const listServices = async (req, res, next) => {
  try {
    const services = await Service.find({
      barberShop: req.user.barberShop,
      isActive: true,
    }).sort({ name: 1 });
    res.json(services);
  } catch (err) {
    next(err);
  }
};

// POST /api/services  (admin only) - add a catalog service
const createService = async (req, res, next) => {
  try {
    const { name, price, shopPercent } = req.body;

    if (!name || price == null || shopPercent == null) {
      return res
        .status(400)
        .json({ message: "name, price and shopPercent are required" });
    }

    const service = await Service.create({
      name: name.trim(),
      price,
      shopPercent,
      barberShop: req.user.barberShop,
    });

    res.status(201).json(service);
  } catch (err) {
    next(err);
  }
};

// PUT /api/services/:id  (admin only)
const updateService = async (req, res, next) => {
  try {
    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, barberShop: req.user.barberShop },
      req.body,
      { new: true, runValidators: true }
    );

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.json(service);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/services/:id  (admin only)
const deleteService = async (req, res, next) => {
  try {
    const service = await Service.findOneAndDelete({
      _id: req.params.id,
      barberShop: req.user.barberShop,
    });

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.json({ message: "Service deleted" });
  } catch (err) {
    next(err);
  }
};

// POST /api/services/log  (worker only) - submit a performed service
// body: { barberId, serviceId, price }
const submitServiceLog = async (req, res, next) => {
  try {
    const { barberId, serviceId, price } = req.body;

    if (!barberId || !serviceId || price == null) {
      return res
        .status(400)
        .json({ message: "barberId, serviceId and price are required" });
    }

    const [barber, service] = await Promise.all([
      Barber.findOne({ _id: barberId, barberShop: req.user.barberShop }),
      Service.findOne({ _id: serviceId, barberShop: req.user.barberShop }),
    ]);

    if (!barber) return res.status(404).json({ message: "Barber not found" });
    if (!service) return res.status(404).json({ message: "Service not found" });

    const log = await ServiceLog.create({
      barber: barber._id,
      service: service._id,
      price,
      shopPercent: service.shopPercent,
      recordedBy: req.user.id,
      barberShop: req.user.barberShop,
    });

    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
};

// GET /api/services/log/today  (worker or admin) - today's entries for this shop
const listTodayServiceLogs = async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const logs = await ServiceLog.find({
      barberShop: req.user.barberShop,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .populate("barber", "name")
      .populate("service", "name")
      .sort({ createdAt: -1 });

    res.json(logs);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listServices,
  createService,
  updateService,
  deleteService,
  submitServiceLog,
  listTodayServiceLogs,
};
