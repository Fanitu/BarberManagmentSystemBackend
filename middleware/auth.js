const jwt = require("jsonwebtoken");

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
  console.log("User role:", req.user?.role); // Debugging line
  console.log("coming user var:", req.user); // Debugging line
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden: insufficient role" });
  }
  next();
};

module.exports = { protect, requireRole };