const jwt = require("jsonwebtoken");

/**
 * Signs a JWT for any authenticated principal in the system.
 * @param {Object} payload - e.g. { id, role, barberShop }
 */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

module.exports = generateToken;
