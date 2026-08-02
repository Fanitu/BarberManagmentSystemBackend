const { body } = require("express-validator");
const { mongoIdParam } = require("./common");

const createBarberValidator = [
  body("name").trim().notEmpty().withMessage("name is required").isLength({ max: 100 }),
  body("phone")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 30 })
    .withMessage("phone is too long"),
  body("paymentDay")
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage("paymentDay must be 0-6 (Sun-Sat)"),
];

const updateBarberValidator = [
  mongoIdParam(),
  body("name").optional().trim().isLength({ min: 1, max: 100 }),
  body("phone").optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body("paymentDay")
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage("paymentDay must be 0-6 (Sun-Sat)"),
  body("isActive").optional().isBoolean(),
];

const barberIdParamValidator = [mongoIdParam()];

module.exports = { createBarberValidator, updateBarberValidator, barberIdParamValidator };