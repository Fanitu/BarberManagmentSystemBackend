const jwt = require("jsonwebtoken");

const Worker = require("../models/Worker");

const protect = (req, res, next) => {
  // Check for token in cookies first, then fall back to Authorization header
  const token = req.cookies?.token || 
                (req.headers.authorization?.startsWith("Bearer ") ? 
                 req.headers.authorization.split(" ")[1] : null);

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, invalid token" });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden: insufficient role" });
  }
  next();
};

const requireActiveWorker = async (req, res, next) => {
  if (req.user?.role !== "worker") return next(); // only gates workers
  const worker = await Worker.findById(req.user.id);
  if (!worker || !worker.isActive) {
    return res.status(403).json({ message: "Your account is pending admin approval" });
  }
  next();
};

module.exports = { protect, requireRole, requireActiveWorker };