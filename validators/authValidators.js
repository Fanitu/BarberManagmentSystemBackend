const { body } = require("express-validator");

const loginValidator = [
  body("name").trim().notEmpty().withMessage("name is required").isLength({ max: 100 }),
  body("password").notEmpty().withMessage("password is required").isLength({ max: 200 }),
  body("barberCode")
    .trim()
    .notEmpty()
    .withMessage("barberCode is required")
    .isLength({ max: 30 }),
];

const superAdminLoginValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("email is required")
    .isEmail()
    .withMessage("must be a valid email")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("password is required").isLength({ max: 200 }),
];

module.exports = { loginValidator, superAdminLoginValidator };
