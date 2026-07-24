const jwt = require("jsonwebtoken");

/**
 * Verifies the Bearer token and attaches the decoded payload to req.user.
 * Payload shape: { id, role: 'worker'|'admin'|'superadmin', barberShop? }
 */
const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, invalid token" });
  }
};

/**
 * Restricts access to one or more roles. Use after `protect`.
 * e.g. router.get('/', protect, requireRole('admin'), handler)
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden: insufficient role" });
  }
  next();
};

module.exports = { protect, requireRole };
