const crypto = require("crypto");

/**
 * Generates a short, human-typeable, unique-ish barber code, e.g. "BS-7F3K2Q".
 * Uniqueness against the DB is still enforced by the unique index on
 * BarberShop.barberCode; the caller should retry on collision.
 */
const generateBarberCode = () => {
  const random = crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `BS-${random}`;
};

module.exports = generateBarberCode;
