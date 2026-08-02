const { body } = require("express-validator");

const createDebtValidator = [
  body("barberId").isMongoId().withMessage("a valid barberId is required"),
  body("amount")
    .notEmpty()
    .withMessage("amount is required")
    .isFloat({ min: 0 })
    .withMessage("amount must be a non-negative number"),
];

module.exports = { createDebtValidator };